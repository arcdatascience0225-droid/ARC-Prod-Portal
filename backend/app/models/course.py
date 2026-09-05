import uuid
from typing import Optional
from datetime import date

from sqlalchemy import String, Text, Date, Integer, ForeignKey, Column, DateTime, func
from app.core.db_types import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Course(BaseModel):
    __tablename__ = "courses"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_weeks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    batches: Mapped[list["Batch"]] = relationship("Batch", back_populates="course", cascade="all, delete-orphan")


class Batch(BaseModel):
    __tablename__ = "batches"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    trainer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), default="active")
    batch_time: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # e.g. "10:00 AM - 12:00 PM"

    course: Mapped["Course"] = relationship("Course", back_populates="batches")


class BatchStudent(BaseModel):
    """Student enrollment in a batch. `user_id` is the canonical FK name."""
    __tablename__ = "batch_students"

    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class BatchFaculty(BaseModel):
    __tablename__ = "batch_faculty"

    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False)
    faculty_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role_in_batch: Mapped[str] = mapped_column(String(50), default="faculty")
