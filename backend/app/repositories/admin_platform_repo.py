from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.user import User
from app.models.phase5_models import (
    AuditLog, Course, Batch, BatchStudent, Payment, PlatformSetting,
)


class AdminRepo:
    def __init__(self, db: Session):
        self.db = db

    # Users
    def list_users(self, role: str | None = None, skip: int = 0, limit: int = 50,
                    search: str | None = None):
        q = self.db.query(User)
        if role:
            q = q.filter(User.role == str(role).strip().lower().replace(" ", "_"))
        if search:
            like = f"%{search}%"
            q = q.filter((User.name.ilike(like)) | (User.email.ilike(like)))
        total = q.count()
        items = q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def get_user(self, user_id):
        return self.db.query(User).filter(User.id == user_id).first()

    def update_user_role(self, user, role: str):
        user.role = role
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, user):
        self.db.delete(user)
        self.db.commit()

    # Courses
    def create_course(self, **kwargs) -> Course:
        course = Course(**kwargs)
        self.db.add(course)
        self.db.commit()
        self.db.refresh(course)
        return course

    def list_courses(self):
        return self.db.query(Course).order_by(Course.created_at.desc()).all()

    def get_course(self, course_id):
        return self.db.query(Course).filter(Course.id == course_id).first()

    def delete_course(self, course):
        self.db.delete(course)
        self.db.commit()

    # Batches
    def create_batch(self, **kwargs) -> Batch:
        batch = Batch(**kwargs)
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def list_batches(self, course_id=None):
        q = self.db.query(Batch)
        if course_id:
            q = q.filter(Batch.course_id == course_id)
        return q.order_by(Batch.created_at.desc()).all()

    def get_batch(self, batch_id):
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def enroll_student(self, batch_id, user_id):
        bs = BatchStudent(batch_id=batch_id, user_id=user_id)
        self.db.add(bs)
        self.db.commit()
        self.db.refresh(bs)
        return bs

    def batch_students(self, batch_id):
        return self.db.query(BatchStudent).filter(BatchStudent.batch_id == batch_id).all()

    # Payments
    def create_payment(self, **kwargs) -> Payment:
        p = Payment(**kwargs)
        self.db.add(p)
        self.db.commit()
        self.db.refresh(p)
        return p

    def list_payments(self, status: str | None = None, user_id=None):
        q = self.db.query(Payment)
        if status:
            q = q.filter(Payment.status == status)
        if user_id:
            q = q.filter(Payment.user_id == user_id)
        return q.order_by(Payment.created_at.desc()).all()

    def get_payment(self, payment_id):
        return self.db.query(Payment).filter(Payment.id == payment_id).first()

    def update_payment_status(self, payment, status: str):
        from datetime import datetime, timezone
        payment.status = status
        if status == "paid":
            payment.paid_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    # Settings
    def upsert_setting(self, key: str, value: dict, updated_by):
        setting = self.db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
        if setting:
            setting.value = value
            setting.updated_by = updated_by
        else:
            setting = PlatformSetting(key=key, value=value, updated_by=updated_by)
            self.db.add(setting)
        self.db.commit()
        self.db.refresh(setting)
        return setting

    def list_settings(self):
        return self.db.query(PlatformSetting).all()

    # Audit log
    def add_audit_log(self, user_id, action, module, entity_type=None, entity_id=None, details=None, ip=None):
        log = AuditLog(
            user_id=user_id, action=action, module=module, entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None, details=details or {}, ip_address=ip,
        )
        self.db.add(log)
        self.db.commit()
        return log

    def list_audit_logs(self, module=None, skip=0, limit=100):
        q = self.db.query(AuditLog)
        if module:
            q = q.filter(AuditLog.module == module)
        return q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
