from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import require_student, CurrentUser
from app.services.student_service import StudentService
from app.schemas import student_schemas as sc

router = APIRouter(prefix="/api/v1/student/dashboard", tags=["Student Dashboard"])


@router.get("", response_model=sc.DashboardResponse)
def get_dashboard(
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db),
):
    """STU-DB-001..007: Welcome, progress %, attendance %, upcoming assessments, notifications."""
    return StudentService(db).get_dashboard(current_user.id)
