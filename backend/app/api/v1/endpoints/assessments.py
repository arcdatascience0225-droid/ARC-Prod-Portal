from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.api.deps import faculty_or_trainer, require_roles, CurrentUser
from app.core.database import get_db
from app.schemas.assessment import AssessmentCreate, AssessmentOut
from app.services.assessment_service import AssessmentService
from app.models.assessment import Assessment, Result, ProctorSnapshot, Question, StudentAnswer
from app.models.assignment_feedback import AssignmentFeedback
from app.models.user import User

router = APIRouter(prefix="/assessments", tags=["Assessments"])


@router.post("", response_model=AssessmentOut, summary="Create assessment/assignment from bank questions (FAC-003)")
def create_assessment(
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return AssessmentService(db).create_assessment(payload, created_by=current_user.id)


@router.get("", response_model=List[AssessmentOut], summary="List assessments I created (FAC-003)")
def my_assessments(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return AssessmentService(db).list_my_assessments(created_by=current_user.id)


@router.get("/all", response_model=List[AssessmentOut], summary="Admin/Super Admin: every assessment, any faculty")
def all_assessments(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles("admin", "super_admin")),
):
    return AssessmentService(db).list_all_assessments()


@router.patch("/{assessment_id}/toggle-active", response_model=AssessmentOut)
def toggle_active(
    assessment_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """Activate or deactivate an assessment (FAC-003)."""
    a = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    a.is_active = not a.is_active
    db.commit()
    db.refresh(a)
    return AssessmentService(db)._to_out(a)


@router.delete("/{assessment_id}", status_code=204)
def delete_assessment(
    assessment_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """Delete an assessment and everything that references it (FAC-003)."""
    a = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")

    result_ids = [
        r.id for r in db.query(Result.id).filter(Result.assessment_id == assessment_id).all()
    ]
    if result_ids:
        db.query(StudentAnswer).filter(StudentAnswer.result_id.in_(result_ids)).delete(synchronize_session=False)
        db.query(AssignmentFeedback).filter(AssignmentFeedback.result_id.in_(result_ids)).delete(synchronize_session=False)
        db.query(ProctorSnapshot).filter(ProctorSnapshot.result_id.in_(result_ids)).delete(synchronize_session=False)

    db.query(ProctorSnapshot).filter(ProctorSnapshot.assessment_id == assessment_id).delete(synchronize_session=False)
    db.query(Result).filter(Result.assessment_id == assessment_id).delete(synchronize_session=False)
    db.query(Question).filter(Question.assessment_id == assessment_id).delete(synchronize_session=False)

    db.delete(a)
    db.commit()


@router.get("/{assessment_id}/monitor")
def live_monitor(
    assessment_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """Live monitoring: who is currently attempting + their violations."""
    results = (
        db.query(Result, User)
        .join(User, User.id == Result.user_id)
        .filter(Result.assessment_id == assessment_id, Result.status.in_(["in_progress", "terminated"]))
        .all()
    )
    snapshots = (
        db.query(ProctorSnapshot)
        .filter(ProctorSnapshot.assessment_id == assessment_id)
        .order_by(ProctorSnapshot.captured_at.desc())
        .all()
    )
    import base64, os as _os
    snap_by_user = {}
    for snap in snapshots:
        uid = str(snap.user_id)
        if uid not in snap_by_user:
            snap_by_user[uid] = snap.image_path

    def _snap_b64(path):
        if not path:
            return None
        try:
            with open(path, "rb") as f:
                return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
        except Exception:
            return None

    return [
        {
            "resultId": str(r.id),
            "studentId": str(r.user_id),
            "studentName": u.name,
            "studentEmail": u.email,
            "ipAddress": getattr(r, "ip_address", None) or "unknown",
            "startedAt": r.started_at,
            "violationCount": r.violation_count,
            "isFlagged": bool(r.is_flagged),
            "lastViolationReason": getattr(r, "last_violation_reason", None),
            "lastViolationSeverity": getattr(r, "last_violation_severity", None),
            "isTerminated": bool(getattr(r, "is_terminated", False)),
            "status": r.status,
            "helpRequested": bool(getattr(r, "help_requested", False)),
            "helpMessage": getattr(r, "help_message", None),
            "latestSnapshot": _snap_b64(snap_by_user.get(str(r.user_id))),
        }
        for r, u in results
    ]


@router.get("/{assessment_id}/results")
def assessment_results(
    assessment_id: UUID,
    status: str | None = None,  # completed | in_progress | terminated | not_started
    search: str | None = None,  # matches student name or email, case-insensitive
    batch_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """All results for this assessment, any status — unlike /monitor (which
    only shows in_progress/terminated for live proctoring), this is for
    reviewing outcomes after a test ends: who has/hasn't taken it, their
    score, and rank. Optional batch_id narrows to students enrolled in that
    batch (and, when set, also reports how many enrolled students haven't
    attempted at all — impossible to know without a batch roster to compare
    against). Without batch_id, results aren't batch-scoped at all: a
    student enrolled after the fact, or from a batch other than the ones
    the assessment was assigned to, still shows up here."""
    from app.models.course import BatchStudent

    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    query = db.query(Result, User).join(User, User.id == Result.user_id).filter(
        Result.assessment_id == assessment_id
    )
    if batch_id:
        query = query.join(BatchStudent, BatchStudent.user_id == User.id).filter(
            BatchStudent.batch_id == batch_id
        )
    if status:
        query = query.filter(Result.status == status)
    if search:
        like = f"%{search.strip().lower()}%"
        from sqlalchemy import func, or_
        query = query.filter(or_(func.lower(User.name).like(like), func.lower(User.email).like(like)))

    rows = query.order_by(Result.score.desc().nullslast()).all()

    max_marks = None
    try:
        # Questions live in two places: bank-sourced ones are listed in
        # assessment.question_ids; inline-authored ones instead have
        # questions.assessment_id set to this assessment. Counting only one
        # source was undercounting (or zeroing out) max_marks, showing "?"
        # to faculty even for assessments with real marks.
        inline_qs = db.query(Question).filter(Question.assessment_id == assessment_id).all()
        bank_ids = [qid for qid in (assessment.question_ids or []) if str(qid) not in {str(q.id) for q in inline_qs}]
        bank_qs = db.query(Question).filter(Question.id.in_(bank_ids)).all() if bank_ids else []
        all_qs = inline_qs + bank_qs
        if all_qs:
            max_marks = sum(q.marks for q in all_qs)
    except Exception:
        pass

    scored = [(r, u) for r, u in rows if r.score is not None]
    rank_by_result = {r.id: i + 1 for i, (r, _u) in enumerate(scored)}

    scores = [float(r.score) for r, _u in scored]
    summary = {
        "averageScore": round(sum(scores) / len(scores), 2) if scores else None,
        "highestScore": max(scores) if scores else None,
        "lowestScore": min(scores) if scores else None,
        "attemptedCount": len(rows),
        "notAttemptedCount": None,
    }
    if batch_id:
        roster_ids = {
            row.user_id for row in db.query(BatchStudent).filter(BatchStudent.batch_id == batch_id).all()
        }
        attempted_ids = {r.user_id for r, _u in rows}
        summary["notAttemptedCount"] = len(roster_ids - attempted_ids)

    # Latest mock interview evaluation per student (manually entered by
    # admin/faculty, or auto-scored by the platform) — shown alongside the
    # assessment score so faculty see the full picture in one place.
    from app.models.mock_interview import MockInterview, MockInterviewEvaluation
    student_ids = [r.user_id for r, _u in rows]
    mock_by_student: dict = {}
    if student_ids:
        mock_rows = (
            db.query(MockInterview, MockInterviewEvaluation)
            .join(MockInterviewEvaluation, MockInterviewEvaluation.mock_interview_id == MockInterview.id)
            .filter(MockInterview.student_id.in_(student_ids))
            .order_by(MockInterview.scheduled_at.desc())
            .all()
        )
        for mi, ev in mock_rows:
            if mi.student_id not in mock_by_student:  # keep only the latest per student
                mock_by_student[mi.student_id] = {
                    "overallScore": ev.overall_score,
                    "maxScore": ev.max_score or 100,
                    "feedbackText": ev.feedback_text,
                    "recordedAt": mi.scheduled_at,
                }

    return {
        "assessmentTitle": assessment.title,
        "maxMarks": max_marks,
        "totalAttempts": len(rows),
        "summary": summary,
        "results": [
            {
                "resultId": str(r.id),
                "studentId": str(r.user_id),
                "studentName": u.name,
                "studentEmail": u.email,
                "status": r.status,
                "score": r.score,
                "rank": rank_by_result.get(r.id),
                "isTerminated": bool(getattr(r, "is_terminated", False)),
                "violationCount": r.violation_count,
                "startedAt": r.started_at,
                "submittedAt": getattr(r, "submitted_at", None),
                "mockInterview": mock_by_student.get(r.user_id),
            }
            for r, u in rows
        ],
    }


@router.post("/results/{result_id}/reinstate", status_code=200)
def reinstate_result(
    result_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """Faculty approves a student's request to resume a terminated attempt."""
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(404, "Result not found")
    result.is_terminated = False
    result.help_requested = False
    result.status = "in_progress"
    db.commit()
    return {"status": "reinstated"}


@router.post("/results/{result_id}/deny-help", status_code=200)
def deny_help_request(
    result_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """Faculty dismisses a student's help/resume request without reinstating."""
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(404, "Result not found")
    result.help_requested = False
    db.commit()
    return {"status": "dismissed"}


@router.get("/{assessment_id}/snapshots")
def assessment_snapshots(
    assessment_id: UUID,
    student_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """All snapshots for post-exam review."""
    q = db.query(ProctorSnapshot, User).join(User, User.id == ProctorSnapshot.user_id).filter(
        ProctorSnapshot.assessment_id == assessment_id
    )
    if student_id:
        q = q.filter(ProctorSnapshot.user_id == student_id)
    rows = q.order_by(ProctorSnapshot.captured_at.desc()).all()
    return [
        {
            "id": str(s.id),
            "studentId": str(s.user_id),
            "studentName": u.name,
            "imagePath": s.image_path,
            "violationCount": s.violation_count,
            "capturedAt": s.captured_at,
        }
        for s, u in rows
    ]
