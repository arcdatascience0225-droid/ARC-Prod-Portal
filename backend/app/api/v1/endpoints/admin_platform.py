from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import require_roles
from app.services.admin_platform_service import AdminService
from app.schemas import admin_platform as schemas

router = APIRouter(prefix="/admin", tags=["Admin"])

ADMIN_ROLES = ("Super Admin", "Admin")


def _user_out(u, batch_name: str | None = None) -> schemas.UserOut:
    return schemas.UserOut(
        id=u.id, name=u.name, email=u.email, role=u.role,
        isActive=bool(getattr(u, "is_active", True)), createdAt=u.created_at,
        batchName=batch_name, hasCustomPermissions=getattr(u, "permissions", None) is not None,
    )


@router.get("/users", response_model=schemas.UserListResponse)
def list_users(role: str | None = None, search: str | None = None, skip: int = 0, limit: int = 50,
                db: Session = Depends(get_db), actor=Depends(require_roles(*ADMIN_ROLES))):
    users, total = AdminService(db).list_users(role, skip, limit, search)

    # Batch name per student, fetched in one query instead of one-per-row.
    from app.models.course import BatchStudent, Batch
    student_ids = [u.id for u in users if u.role == "student"]
    batch_by_user: dict = {}
    if student_ids:
        rows = (
            db.query(BatchStudent.user_id, Batch.name)
            .join(Batch, Batch.id == BatchStudent.batch_id)
            .filter(BatchStudent.user_id.in_(student_ids))
            .all()
        )
        batch_by_user = {uid: name for uid, name in rows}

    return schemas.UserListResponse(
        total=total, items=[_user_out(u, batch_by_user.get(u.id)) for u in users]
    )


@router.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(payload: schemas.UserCreateByAdmin, db: Session = Depends(get_db),
                 actor=Depends(require_roles("Super Admin"))):
    u = AdminService(db).create_user(actor, payload.name, payload.email, payload.password, payload.role)
    return _user_out(u)


# Registered under both verbs: one frontend client was calling PATCH against
# a PUT-only route and getting 405.
@router.put("/users/{user_id}/role", response_model=schemas.UserOut)
@router.patch("/users/{user_id}/role", response_model=schemas.UserOut)
def update_role(user_id: UUID, payload: schemas.UserUpdateRole, db: Session = Depends(get_db),
                 actor=Depends(require_roles("Super Admin"))):
    u = AdminService(db).update_role(actor, user_id, payload.role)
    return _user_out(u)


@router.patch("/users/{user_id}/access", response_model=schemas.UserOut)
def toggle_user_access(
    user_id: UUID, payload: schemas.UserToggleAccess,
    db: Session = Depends(get_db),
    actor=Depends(require_roles(*ADMIN_ROLES))
):
    """Enable or disable a user account (does not delete it)."""
    u = AdminService(db).toggle_user_access(actor, user_id, payload.is_active)
    return _user_out(u)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: UUID, db: Session = Depends(get_db), actor=Depends(require_roles("Super Admin"))):
    AdminService(db).delete_user(actor, user_id)


@router.post("/courses", response_model=schemas.CourseOut, status_code=201)
def create_course(payload: schemas.CourseCreate, db: Session = Depends(get_db),
                   actor=Depends(require_roles(*ADMIN_ROLES))):
    return AdminService(db).create_course(actor, payload)


@router.get("/courses", response_model=list[schemas.CourseOut])
def list_courses(db: Session = Depends(get_db), actor=Depends(require_roles(*ADMIN_ROLES, "Faculty", "Trainer"))):
    return AdminService(db).list_courses()


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: UUID, db: Session = Depends(get_db), actor=Depends(require_roles(*ADMIN_ROLES))):
    AdminService(db).delete_course(actor, course_id)


@router.post("/batches", response_model=schemas.BatchOut, status_code=201)
def create_batch(payload: schemas.BatchCreate, db: Session = Depends(get_db),
                  actor=Depends(require_roles(*ADMIN_ROLES))):
    return AdminService(db).create_batch(actor, payload)


@router.get("/batches", response_model=list[schemas.BatchOut])
def list_batches(course_id: UUID | None = None, db: Session = Depends(get_db),
                  actor=Depends(require_roles(*ADMIN_ROLES, "Faculty", "Trainer"))):
    return AdminService(db).list_batches(course_id)


@router.post("/batches/{batch_id}/enroll/{user_id}", status_code=201)
def enroll_student(batch_id: UUID, user_id: UUID, db: Session = Depends(get_db),
                    actor=Depends(require_roles(*ADMIN_ROLES))):
    AdminService(db).enroll_student(actor, batch_id, user_id)
    return {"message": "Student enrolled"}


@router.post("/payments", response_model=schemas.PaymentOut, status_code=201)
def create_payment(payload: schemas.PaymentCreate, db: Session = Depends(get_db),
                    actor=Depends(require_roles(*ADMIN_ROLES))):
    return AdminService(db).create_payment(actor, payload)


@router.get("/payments", response_model=list[schemas.PaymentOut])
def list_payments(status: str | None = None, user_id: UUID | None = None,
                   db: Session = Depends(get_db), actor=Depends(require_roles(*ADMIN_ROLES))):
    return AdminService(db).list_payments(status, user_id)


@router.put("/payments/{payment_id}/status", response_model=schemas.PaymentOut)
def update_payment_status(payment_id: UUID, payload: schemas.PaymentUpdateStatus,
                           db: Session = Depends(get_db), actor=Depends(require_roles(*ADMIN_ROLES))):
    return AdminService(db).update_payment_status(actor, payment_id, payload.status)


@router.put("/settings", response_model=schemas.SettingOut)
def upsert_setting(payload: schemas.SettingUpsert, db: Session = Depends(get_db),
                    actor=Depends(require_roles("Super Admin"))):
    return AdminService(db).upsert_setting(actor, payload.key, payload.value)


@router.get("/settings", response_model=list[schemas.SettingOut])
def list_settings(db: Session = Depends(get_db), actor=Depends(require_roles(*ADMIN_ROLES))):
    return AdminService(db).list_settings()


@router.get("/audit-logs", response_model=list[schemas.AuditLogOut])
def list_audit_logs(module: str | None = None, skip: int = 0, limit: int = 100,
                     db: Session = Depends(get_db), actor=Depends(require_roles(*ADMIN_ROLES))):
    return AdminService(db).list_audit_logs(module, skip, limit)


@router.get("/ai-usage", response_model=list[schemas.AIUsageSummary])
def ai_usage_dashboard(db: Session = Depends(get_db), actor=Depends(require_roles(*ADMIN_ROLES))):
    return AdminService(db).ai_usage_summary()
