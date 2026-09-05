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
