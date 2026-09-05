from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles, get_current_user, CurrentUser
from app.schemas.placement import (
    InterviewCreate,
    InterviewUpdate,
    InterviewOut,
    InterviewAnalyzeRequest,
)
from app.services.placement_service import InterviewService

router = APIRouter(prefix="/api/v1/interviews", tags=["Interview Portal"])

STAFF_ROLES = ["hr", "placement_coordinator", "admin", "super_admin", "faculty", "trainer"]


class FeedbackRequest(BaseModel):
    feedback: str
    rating: int


@router.post("", response_model=InterviewOut, status_code=201)
def schedule_interview(
    data: InterviewCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(STAFF_ROLES)),
):
    """INT-001: Schedule an interview round for an application."""
    return InterviewService(db).schedule_interview(data, user.id)


@router.get("/{interview_id}", response_model=InterviewOut)
def get_interview(
    interview_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """INT-001: Visible to student (own) + staff. Basic ownership check done client-side by
    filtering the student's own interview list; students should call /interviews/my instead."""
    return InterviewService(db).get_interview(interview_id)


@router.get("/application/{application_id}", response_model=List[InterviewOut])
def list_by_application(
    application_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return InterviewService(db).list_for_application(application_id)


@router.get("/my/upcoming", response_model=List[InterviewOut])
def my_upcoming_interviews(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(["student"])),
):
    """STU-PL-002: Student view of scheduled interview dates."""
    return InterviewService(db).list_for_student(user.id)


@router.get("/my/assigned", response_model=List[InterviewOut])
def my_assigned_interviews(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(STAFF_ROLES)),
):
    """Interviewer's own schedule."""
    return InterviewService(db).list_for_interviewer(user.id)


@router.put("/{interview_id}", response_model=InterviewOut)
def update_interview(
    interview_id: UUID,
    data: InterviewUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(STAFF_ROLES)),
):
    """INT-002: Reschedule / update mode / attach recording (mock video call structure)."""
    return InterviewService(db).update_interview(interview_id, data)


@router.post("/{interview_id}/feedback", response_model=InterviewOut)
def submit_feedback(
    interview_id: UUID,
    data: FeedbackRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(STAFF_ROLES)),
):
    """INT-004: Capture interviewer feedback + rating, marks interview completed."""
    return InterviewService(db).submit_feedback(interview_id, data.feedback, data.rating)


@router.post("/{interview_id}/analyze", response_model=InterviewOut)
def analyze_interview(
    interview_id: UUID,
    data: InterviewAnalyzeRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(STAFF_ROLES)),
):
    """INT-003: AI (Gemini) analysis + objective scoring of interview transcript."""
    return InterviewService(db).analyze_transcript(interview_id, data.transcript, user.id)
