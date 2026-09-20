"""Canonical `attendance` table. Batch-based (marked by faculty/trainer per
session) - this superseded the Student Portal module's simpler session-based
design during integration; student-facing attendance % ​is computed by
filtering this table on `student_id`."""
from sqlalchemy import Column, String, Date, ForeignKey
from app.core.db_types import UUID

from app.core.database import Base
from app.models.base import BaseModelMixin


class Attendance(Base, BaseModelMixin):
    __tablename__ = "attendance"

    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="present")  # present | absent | late
    marked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    method = Column(String(30), nullable=False, default="manual")  # manual | face_recognition
    mode = Column(String(20), nullable=False, default="offline")  # online | offline — which kind of class session this was


class Holiday(Base, BaseModelMixin):
    """A day excluded from attendance percentages for a batch (or every
    batch, if batch_id is null)."""
    __tablename__ = "holidays"

    date = Column(Date, nullable=False)
    label = Column(String(200), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class AttendanceNote(Base, BaseModelMixin):
    """Optional reason + photo attached to one attendance record — new
    table rather than new columns on `attendance`, since that table
    already exists in production and create_tables.py never alters
    existing tables."""
    __tablename__ = "attendance_notes"

    attendance_id = Column(UUID(as_uuid=True), ForeignKey("attendance.id"), nullable=False, unique=True)
    reason = Column(String(300), nullable=True)
    photo_url = Column(String(500), nullable=True)
