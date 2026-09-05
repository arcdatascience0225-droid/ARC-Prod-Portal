from uuid import UUID
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.batch import Batch, BatchStudent


class BatchRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> Batch:
        batch = Batch(**kwargs)
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def get(self, batch_id: UUID) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def list_for_faculty(self, faculty_id: UUID, is_admin: bool = False) -> List[Batch]:
        q = self.db.query(Batch)
        if not is_admin:
            q = q.filter((Batch.faculty_id == faculty_id) | (Batch.trainer_id == faculty_id))
        return q.all()

    def student_count(self, batch_id: UUID) -> int:
        return self.db.query(func.count(BatchStudent.id)).filter(
            BatchStudent.batch_id == batch_id
        ).scalar() or 0

    def add_students(self, batch_id: UUID, student_ids: List[UUID]) -> None:
        existing = {
            row.user_id for row in
            self.db.query(BatchStudent).filter(BatchStudent.batch_id == batch_id).all()
        }
        for sid in student_ids:
            if sid not in existing:
                self.db.add(BatchStudent(batch_id=batch_id, user_id=sid))
        self.db.commit()

    def list_students(self, batch_id: UUID) -> List[UUID]:
        rows = self.db.query(BatchStudent).filter(BatchStudent.batch_id == batch_id).all()
        return [row.user_id for row in rows]

    def batch_ids_for_student(self, user_id: UUID) -> List[UUID]:
        """Reverse of list_students - the batches a given student is enrolled in."""
        rows = (
            self.db.query(BatchStudent.batch_id)
            .filter(BatchStudent.user_id == user_id)
            .distinct()
            .all()
        )
        return [r[0] for r in rows]

    def enroll_student(self, batch_id: UUID, user_id: UUID) -> None:
        """Idempotently enrol one student. Used by the registration flow so a
        student assigned a batch at sign-up actually lands in `batch_students`
        (everything batch-scoped - attendance, performance, announcements -
        reads that table, not `student_profiles.batch_id`)."""
        exists = (
            self.db.query(BatchStudent)
            .filter(BatchStudent.batch_id == batch_id, BatchStudent.user_id == user_id)
            .first()
        )
        if exists:
            return
        self.db.add(BatchStudent(batch_id=batch_id, user_id=user_id))
        self.db.commit()
