import uuid
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.registration import StudentProfile, Document, RegistrationInvite, BulkUploadJob, SignInLog
from app.models.course import Course, Batch


class RegistrationRepository:
    def __init__(self, db: Session):
        self.db = db

    # Student profile
    def create_profile(self, **kwargs) -> StudentProfile:
        profile = StudentProfile(**kwargs)
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def get_profile_by_user_id(self, user_id: uuid.UUID) -> Optional[StudentProfile]:
        return self.db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()

    def find_by_duplicate_hash(self, dup_hash: str):
        return self.db.query(StudentProfile).filter(StudentProfile.duplicate_check_hash == dup_hash).all()

    # Documents
    def add_document(self, **kwargs) -> Document:
        doc = Document(**kwargs)
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    # Invites
    def create_invite(self, **kwargs) -> RegistrationInvite:
        invite = RegistrationInvite(**kwargs)
        self.db.add(invite)
        self.db.commit()
        self.db.refresh(invite)
        return invite

    def get_invite_by_token(self, token: str) -> Optional[RegistrationInvite]:
        return self.db.query(RegistrationInvite).filter(RegistrationInvite.token == token).first()

    def update_invite(self, invite: RegistrationInvite, **kwargs) -> RegistrationInvite:
        for k, v in kwargs.items():
            setattr(invite, k, v)
        self.db.commit()
        self.db.refresh(invite)
        return invite

    # Bulk jobs
    def create_bulk_job(self, **kwargs) -> BulkUploadJob:
        job = BulkUploadJob(**kwargs)
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def update_bulk_job(self, job: BulkUploadJob, **kwargs) -> BulkUploadJob:
        for k, v in kwargs.items():
            setattr(job, k, v)
        self.db.commit()
        self.db.refresh(job)
        return job

    # Courses / batches
    def get_course(self, course_id: uuid.UUID) -> Optional[Course]:
        return self.db.query(Course).filter(Course.id == course_id).first()

    def get_batch(self, batch_id: uuid.UUID) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def find_course_by_ref(self, ref: str) -> Optional[Course]:
        """Resolve a course from a UUID, its code, or its name (case-insensitive).

        Spreadsheet uploads are filled in by humans who have no reason to know
        internal UUIDs, so `course_id` accepts any of the three.
        """
        ref = str(ref).strip()
        if not ref:
            return None
        try:
            return self.db.query(Course).filter(Course.id == uuid.UUID(ref)).first()
        except (ValueError, AttributeError, TypeError):
            pass
        return (
            self.db.query(Course)
            .filter(func.lower(Course.code) == ref.lower())
            .first()
            or self.db.query(Course)
            .filter(func.lower(Course.name) == ref.lower())
            .first()
        )

    def find_batch_by_ref(self, ref: str, course_id: Optional[uuid.UUID] = None) -> Optional[Batch]:
        """Resolve a batch from a UUID or its name, optionally scoped to a course
        (batch names only need to be unique within a course)."""
        ref = str(ref).strip()
        if not ref:
            return None
        try:
            return self.db.query(Batch).filter(Batch.id == uuid.UUID(ref)).first()
        except (ValueError, AttributeError, TypeError):
            pass
        q = self.db.query(Batch).filter(func.lower(Batch.name) == ref.lower())
        if course_id:
            q = q.filter(Batch.course_id == course_id)
        return q.first()

    def list_batches_for_course(self, course_id: uuid.UUID):
        return self.db.query(Batch).filter(Batch.course_id == course_id).all()

    def list_courses(self):
        return self.db.query(Course).all()

    def list_batches(self, course_id: Optional[uuid.UUID] = None):
        query = self.db.query(Batch)
        if course_id:
            query = query.filter(Batch.course_id == course_id)
        return query.all()

    def create_course(self, **kwargs) -> Course:
        course = Course(**kwargs)
        self.db.add(course)
        self.db.commit()
        self.db.refresh(course)
        return course

    def create_batch(self, **kwargs) -> Batch:
        batch = Batch(**kwargs)
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    # Sign-in logs
    def add_sign_in_log(self, **kwargs) -> SignInLog:
        log = SignInLog(**kwargs)
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def list_sign_in_logs(self, skip: int = 0, limit: int = 50, user_id: Optional[uuid.UUID] = None):
        query = self.db.query(SignInLog)
        if user_id:
            query = query.filter(SignInLog.user_id == user_id)
        total = query.count()
        items = query.order_by(SignInLog.created_at.desc()).offset(skip).limit(limit).all()
        return items, total
