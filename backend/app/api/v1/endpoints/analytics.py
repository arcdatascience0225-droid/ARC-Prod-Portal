from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import require_roles, get_current_user
from app.services.analytics_service import AnalyticsService
from app.schemas import analytics as schemas

router = APIRouter(prefix="/analytics", tags=["Analytics"])

STAFF_ROLES = ("Super Admin", "Admin", "Faculty", "Trainer", "HR", "Placement Coordinator")


@router.get("/students/{user_id}", response_model=schemas.StudentAnalyticsOut)
def student_analytics(user_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in STAFF_ROLES and str(current_user.id) != str(user_id):
        from fastapi import HTTPException
        raise HTTPException(403, "Not permitted to view this student's analytics")
    return AnalyticsService(db).student_analytics(user_id)


@router.get("/dashboard-summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("faculty", "trainer", "admin", "super_admin")),
):
    """Overview cards + per-batch progress for the Dashboard landing page.
    Admin/Super Admin see every batch; Faculty/Trainer see only their own."""
    is_admin = current_user.role in ("admin", "super_admin")
    return AnalyticsService(db).dashboard_summary(current_user.id, is_admin=is_admin)


@router.get("/batches/{batch_id}", response_model=schemas.BatchAnalyticsOut)
def batch_analytics(batch_id: UUID, db: Session = Depends(get_db), actor=Depends(require_roles(*STAFF_ROLES))):
    return AnalyticsService(db).batch_analytics(batch_id)


@router.get("/faculty/{faculty_id}", response_model=schemas.FacultyAnalyticsOut)
def faculty_analytics(faculty_id: UUID, db: Session = Depends(get_db), actor=Depends(require_roles(*STAFF_ROLES))):
    return AnalyticsService(db).faculty_analytics(faculty_id)


@router.get("/placements", response_model=schemas.PlacementAnalyticsOut)
def placement_analytics(db: Session = Depends(get_db), actor=Depends(require_roles(*STAFF_ROLES))):
    return AnalyticsService(db).placement_analytics()


@router.get("/courses-attendance", response_model=list[schemas.CourseAttendanceAnalyticsOut])
def course_attendance_analytics(db: Session = Depends(get_db), actor=Depends(require_roles(*STAFF_ROLES))):
    return AnalyticsService(db).course_attendance_analytics()


@router.get("/ai-revenue", response_model=schemas.AIRevenueAnalyticsOut)
def ai_revenue_analytics(db: Session = Depends(get_db), actor=Depends(require_roles("Super Admin", "Admin"))):
    return AnalyticsService(db).ai_revenue_analytics()


@router.post("/students/{user_id}/career-readiness")
def recompute_career_readiness(user_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in STAFF_ROLES and str(current_user.id) != str(user_id):
        from fastapi import HTTPException
        raise HTTPException(403, "Not permitted")
    return AnalyticsService(db).compute_career_readiness(user_id)
