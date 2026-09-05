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
