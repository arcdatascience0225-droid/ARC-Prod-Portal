from uuid import UUID
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session

from app.api.deps import faculty_or_trainer, student_only, CurrentUser
from app.db.session import get_db
from app.schemas.mock_interview import (
    MockInterviewSchedule, MockInterviewOut, MockInterviewSubmit, MockInterviewEvaluationOut,
)
from app.services.mock_interview_service import MockInterviewService

router = APIRouter(prefix="/mock-interviews", tags=["Mock Interview"])


class ManualScoreEntry(BaseModel):
    student_id: UUID
    overall_score: float = Field(ge=0)
    max_score: float = Field(default=100, gt=0)
    feedback_text: Optional[str] = None


@router.post("/manual-score", status_code=201, summary="Faculty/Admin: manually record a mock interview result (e.g. an in-person round)")
def record_manual_score(
    payload: ManualScoreEntry,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """Not every mock interview happens through this platform — some are
    conducted in person or over an external call. This lets faculty/admin
    log a result directly so it still shows up next to the student's
    assessment results."""
    from app.models.mock_interview import MockInterview, MockInterviewEvaluation

    if payload.overall_score > payload.max_score:
        raise HTTPException(status_code=400, detail="Score cannot exceed the total marks")

    mi = MockInterview(
        student_id=payload.student_id,
        scheduled_by=current_user.id,
        scheduled_at=datetime.utcnow(),
        mode="text",
        status="completed",
    )
    db.add(mi)
    db.flush()
    ev = MockInterviewEvaluation(
        mock_interview_id=mi.id,
        overall_score=payload.overall_score,
        max_score=payload.max_score,
        feedback_text=payload.feedback_text,
    )
    db.add(ev)
    db.commit()
    return {"mockInterviewId": str(mi.id), "overallScore": payload.overall_score, "maxScore": payload.max_score}


# ---------- Faculty: schedule + view ----------

@router.post("", response_model=MockInterviewOut, summary="Schedule a mock interview for a student (FAC-010)")
def schedule_interview(
    payload: MockInterviewSchedule,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return MockInterviewService(db).schedule(payload, scheduled_by=current_user.id)


@router.get("/scheduled-by-me", response_model=List[MockInterviewOut],
            summary="List mock interviews I scheduled (FAC-010)")
def my_scheduled_interviews(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return MockInterviewService(db).list_scheduled_by(current_user.id)


@router.get("/{mock_interview_id}/evaluation", response_model=MockInterviewEvaluationOut,
            summary="View AI evaluation for a completed mock interview (FAC-010, STU-MI-003)")
def get_evaluation(
    mock_interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    result = MockInterviewService(db).get_evaluation(mock_interview_id)
    if not result:
        raise HTTPException(status_code=404, detail="Evaluation not available yet")
    return result


# ---------- Student: take + submit ----------

@router.get("/my-interviews", response_model=List[MockInterviewOut],
            summary="List mock interviews scheduled for me (STU-MI-001)")
def my_interviews(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(student_only),
):
    return MockInterviewService(db).list_for_student(current_user.id)


@router.post("/{mock_interview_id}/submit", response_model=MockInterviewEvaluationOut,
             summary="Submit mock interview answers -> triggers AI analysis (STU-MI-002, STU-MI-003, STU-MI-004)")
def submit_interview(
    mock_interview_id: UUID,
    payload: MockInterviewSubmit,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(student_only),
):
    return MockInterviewService(db).submit(mock_interview_id, payload)


@router.get("/{mock_interview_id}/my-evaluation", response_model=MockInterviewEvaluationOut,
            summary="Student views own interview feedback + scores (STU-MI-003, STU-MI-005)")
def my_evaluation(
    mock_interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(student_only),
):
    result = MockInterviewService(db).get_evaluation(mock_interview_id)
    if not result:
        raise HTTPException(status_code=404, detail="Evaluation not available yet")
    return result
