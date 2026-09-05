from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.repositories.admin_platform_repo import AdminRepo
from app.repositories.analytics_repo import AnalyticsRepo
from app.core.security import hash_password
from app.models.user import User
from app.models.enums import RoleEnum

VALID_ROLES = [r.value for r in RoleEnum]


class AdminService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AdminRepo(db)
        self.analytics_repo = AnalyticsRepo(db)

    # Users / RBAC
    def list_users(self, role, skip, limit, search=None):
        return self.repo.list_users(role, skip, limit, search)

    def create_user(self, actor, name, email, password, role):
        if role not in VALID_ROLES:
            raise HTTPException(400, "Invalid role")
        if self.db.query(User).filter(User.email == email).first():
            raise HTTPException(409, "Email already registered")
        user = User(name=name, email=email, password_hash=hash_password(password), role=role)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        self.repo.add_audit_log(actor.id, "create_user", "admin", "user", user.id, {"role": role})
        return user

    def toggle_user_access(self, actor, user_id, is_active: bool):
        from app.models.user import User
        u = self.db.query(User).filter(User.id == user_id).first()
        if not u:
            from fastapi import HTTPException
            raise HTTPException(404, "User not found")
        u.is_active = is_active
        self.db.commit()
        self.db.refresh(u)
        return u

    def update_role(self, actor, user_id, role):
        if role not in VALID_ROLES:
            raise HTTPException(400, "Invalid role")
        user = self.repo.get_user(user_id)
        if not user:
            raise HTTPException(404, "User not found")
        old_role = user.role
        updated = self.repo.update_user_role(user, role)
        self.repo.add_audit_log(actor.id, "update_role", "admin", "user", user_id, {"from": old_role, "to": role})
        return updated

    def delete_user(self, actor, user_id):
        from sqlalchemy.exc import IntegrityError
        from app.models.registration import SignInLog

        user = self.repo.get_user(user_id)
        if not user:
            raise HTTPException(404, "User not found")

        # Sign-in logs are pure history with nothing else depending on
        # them — safe to purge alongside the user. Other tables (results,
        # batch enrollments, assessments they created, etc.) are NOT
        # touched here on purpose: silently cascading those away could
        # quietly break another student's rank/percentile or a batch's
        # roster. If those exist, the delete below fails with a clear
        # message instead of a raw 500, and the admin can deactivate the
        # account instead of deleting it.
        self.db.query(SignInLog).filter(SignInLog.user_id == user_id).delete()

        try:
            self.repo.delete_user(user)
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail=(
                    "This user has related records (batch enrollments, results, "
                    "submissions, etc.) and can't be deleted. Use 'Revoke access' "
                    "instead to disable their account without losing that history."
                ),
            )
        self.repo.add_audit_log(actor.id, "delete_user", "admin", "user", user_id, {})

    # Courses
    def create_course(self, actor, data):
        course = self.repo.create_course(
            name=data.name, code=data.code, description=data.description,
            duration_weeks=data.durationWeeks, created_by=actor.id,
        )
        self.repo.add_audit_log(actor.id, "create_course", "admin", "course", course.id, {})
        return course

    def list_courses(self):
        return self.repo.list_courses()

    def delete_course(self, actor, course_id):
        course = self.repo.get_course(course_id)
        if not course:
            raise HTTPException(404, "Course not found")
        self.repo.delete_course(course)
        self.repo.add_audit_log(actor.id, "delete_course", "admin", "course", course_id, {})

    # Batches
    def create_batch(self, actor, data):
        if not self.repo.get_course(data.courseId):
            raise HTTPException(404, "Course not found")
        batch = self.repo.create_batch(
            course_id=data.courseId, name=data.name, start_date=data.startDate,
            end_date=data.endDate, faculty_id=data.facultyId, trainer_id=data.trainerId,
        )
        self.repo.add_audit_log(actor.id, "create_batch", "admin", "batch", batch.id, {})
        return batch

    def list_batches(self, course_id=None):
        from app.models.user import User
        batches = self.repo.list_batches(course_id)
        for b in batches:
            faculty_id = getattr(b, "faculty_id", None) or getattr(b, "trainer_id", None)
            b.facultyName = None
            if faculty_id:
                faculty = self.db.query(User).filter(User.id == faculty_id).first()
                b.facultyName = faculty.name if faculty else None
        return batches

    def enroll_student(self, actor, batch_id, user_id):
        if not self.repo.get_batch(batch_id):
            raise HTTPException(404, "Batch not found")
        rec = self.repo.enroll_student(batch_id, user_id)
        self.repo.add_audit_log(actor.id, "enroll_student", "admin", "batch", batch_id, {"user_id": str(user_id)})
        return rec

    # Payments
    def create_payment(self, actor, data):
        payment = self.repo.create_payment(
            user_id=data.userId, batch_id=data.batchId, amount=data.amount, currency=data.currency,
            payment_method=data.paymentMethod, transaction_id=data.transactionId,
        )
        self.repo.add_audit_log(actor.id, "create_payment", "admin", "payment", payment.id, {})
        return payment

    def list_payments(self, status=None, user_id=None):
        return self.repo.list_payments(status, user_id)

    def update_payment_status(self, actor, payment_id, status):
        payment = self.repo.get_payment(payment_id)
        if not payment:
            raise HTTPException(404, "Payment not found")
        updated = self.repo.update_payment_status(payment, status)
        self.repo.add_audit_log(actor.id, "update_payment_status", "admin", "payment", payment_id, {"status": status})
        return updated

    # Settings
    def upsert_setting(self, actor, key, value):
        setting = self.repo.upsert_setting(key, value, actor.id)
        self.repo.add_audit_log(actor.id, "update_setting", "admin", "setting", key, {"value": value})
        return setting

    def list_settings(self):
        return self.repo.list_settings()

    # Audit log
    def list_audit_logs(self, module=None, skip=0, limit=100):
        return self.repo.list_audit_logs(module, skip, limit)

    # AI usage dashboard
    def ai_usage_summary(self):
        rows = self.analytics_repo.ai_usage_summary()
        return [
            {"module": r.module, "totalTokens": int(r.tokens or 0), "totalCost": float(r.cost or 0), "requestCount": int(r.count or 0)}
            for r in rows
        ]
