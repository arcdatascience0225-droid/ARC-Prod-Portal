from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import require_student, CurrentUser
from app.services.student_service import StudentService
from app.schemas import student_schemas as sc

router = APIRouter(prefix="/api/v1/student/learning", tags=["Student Learning"])


@router.get("/syllabus", response_model=list[sc.SyllabusItemOut])
def get_syllabus(current_user: CurrentUser = Depends(require_student), db: Session = Depends(get_db)):
    """STU-LR-001: Syllabus view with completed/pending status."""
    return StudentService(db).get_syllabus(current_user.id)


@router.patch("/syllabus/{syllabus_item_id}/status", response_model=sc.SyllabusItemOut)
def update_syllabus_status(
    syllabus_item_id: str,
    status: str = Query(..., pattern="^(pending|in_progress|completed)$"),
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-LR-001: Mark syllabus item pending/in_progress/completed."""
    return StudentService(db).update_syllabus_progress(current_user.id, syllabus_item_id, status)


@router.get("/lectures", response_model=list[sc.LectureOut])
def list_lectures(
    syllabus_item_id: Optional[str] = None,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-LR-002: Recorded lectures/notes."""
    return StudentService(db).list_lectures(syllabus_item_id)


@router.get("/assignments", response_model=list[sc.AssignmentOut])
def list_assignments(current_user: CurrentUser = Depends(require_student), db: Session = Depends(get_db)):
    """STU-LR-003: List assignments with my submission status."""
    return StudentService(db).list_assignments(current_user.id)


@router.post("/assignments/submit", response_model=sc.AssignmentSubmissionOut, status_code=201)
def submit_assignment(
    payload: sc.AssignmentSubmissionCreate,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-SB-001..003: Submit assignment (document/archive/notebook/repo link)."""
    return StudentService(db).submit_assignment(current_user.id, payload)


@router.get("/practice-questions", response_model=list[sc.PracticeQuestionOut])
def list_practice_questions(
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-LR-004: Practice questions bank."""
    return StudentService(db).list_practice_questions(topic, difficulty)


@router.get("/daily-challenge", response_model=sc.DailyChallengeOut)
def get_daily_challenge(current_user: CurrentUser = Depends(require_student), db: Session = Depends(get_db)):
    """STU-LR-004: Today's daily challenge."""
    return StudentService(db).get_daily_challenge(current_user.id)


@router.post("/daily-challenge/{challenge_id}/submit")
def submit_daily_challenge(
    challenge_id: str,
    payload: sc.DailyChallengeSubmit,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-LR-004: Submit today's daily challenge answer (once per day)."""
    return StudentService(db).submit_daily_challenge(current_user.id, challenge_id, payload.answer_text)
