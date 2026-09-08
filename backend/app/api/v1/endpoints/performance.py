from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import faculty_or_trainer, CurrentUser
from app.db.session import get_db
from app.schemas.performance import (
    StudentPerformanceRow, BatchAnalytics, AssignmentFeedbackCreate, AssignmentFeedbackOut,
)
from app.services.performance_service import PerformanceService

router = APIRouter(prefix="/performance", tags=["Student Performance"])


@router.post("/assignments", summary="Create a new assignment for students to submit against")
def create_assignment(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    """{"title": "...", "description": "...", "dueDate": "2026-01-01T00:00:00Z" (optional),
    "maxMarks": 100, "fileUrl": "..." (optional attachment, from /uploads/file)}"""
    from fastapi import HTTPException
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    return PerformanceService(db).create_assignment(
        faculty_id=current_user.id, title=title, description=payload.get("description"),
        due_date=payload.get("dueDate"), max_marks=payload.get("maxMarks", 100),
        file_url=payload.get("fileUrl"),
    )


@router.get("/assignments/mine", summary="Assignments I've created")
def list_my_assignments(db: Session = Depends(get_db), current_user: CurrentUser = Depends(faculty_or_trainer)):
    return PerformanceService(db).list_my_assignments(current_user.id)


@router.get("/assignments/{assignment_id}/submissions", summary="Every student's submission for this assignment, with AI pre-check")
def list_submissions(assignment_id: UUID, db: Session = Depends(get_db), current_user: CurrentUser = Depends(faculty_or_trainer)):
    return PerformanceService(db).list_submissions(assignment_id)


@router.post("/assignments/submissions/{submission_id}/grade", summary="Grade a submission with marks + feedback")
def grade_submission(submission_id: UUID, payload: dict, db: Session = Depends(get_db), current_user: CurrentUser = Depends(faculty_or_trainer)):
    """{"marks": 85, "feedback": "..."}"""
    from fastapi import HTTPException
    if "marks" not in payload:
        raise HTTPException(status_code=400, detail="marks is required")
    return PerformanceService(db).grade_submission(submission_id, float(payload["marks"]), payload.get("feedback"))


@router.get("/batch/{batch_id}/analytics", response_model=BatchAnalytics,
            summary="Batch analytics: top performers, weak students, leaderboard (FAC-005)")
def batch_analytics(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return PerformanceService(db).batch_analytics(batch_id)


@router.get("/batch/{batch_id}/students", response_model=List[StudentPerformanceRow],
            summary="Per-student performance rows for a batch (FAC-005)")
def batch_student_performance(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return PerformanceService(db).student_rows_for_batch(batch_id)


@router.post("/feedback", response_model=AssignmentFeedbackOut,
             summary="Evaluate an assignment result + give written feedback (FAC-007)")
def add_feedback(
    payload: AssignmentFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return PerformanceService(db).add_feedback(payload, faculty_id=current_user.id)
