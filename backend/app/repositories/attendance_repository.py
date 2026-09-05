from uuid import UUID
from datetime import date
from typing import List

from sqlalchemy.orm import Session

from app.models.attendance import Attendance


class AttendanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def upsert_entry(self, batch_id: UUID, student_id: UUID, entry_date: date,
                      status: str, marked_by: UUID, method: str) -> Attendance:
        existing = self.db.query(Attendance).filter(
            Attendance.batch_id == batch_id,
            Attendance.student_id == student_id,
            Attendance.date == entry_date,
        ).first()
        if existing:
            existing.status = status
            existing.method = method
            existing.marked_by = marked_by
            self.db.commit()
            self.db.refresh(existing)
            return existing

        record = Attendance(
            batch_id=batch_id, student_id=student_id, date=entry_date,
            status=status, marked_by=marked_by, method=method,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def list_for_batch_date(self, batch_id: UUID, entry_date: date) -> List[Attendance]:
        return self.db.query(Attendance).filter(
            Attendance.batch_id == batch_id, Attendance.date == entry_date
        ).all()

    def list_for_student(self, student_id: UUID) -> List[Attendance]:
        return self.db.query(Attendance).filter(Attendance.student_id == student_id).all()
