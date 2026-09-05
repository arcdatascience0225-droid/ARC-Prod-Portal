"""Faculty/trainer attendance — separate from the student `Attendance` table
(which is batch-scoped and requires a batch_id + student_id). A faculty
member isn't "in a batch" as a student is, so this is a simpler
date+status record, typically marked by a Manager.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Date, DateTime, ForeignKey
from app.core.db_types import UUID
from app.core.database import Base


class StaffAttendance(Base):
    __tablename__ = "staff_attendance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    staff_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="present")  # present | absent | late
    marked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
