import uuid
from typing import Optional
from datetime import date, datetime

from sqlalchemy import String, Date, DateTime, ForeignKey, Boolean, Text, Integer
from app.core.db_types import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import (
    RegistrationSourceEnum,
    InviteStatusEnum,
    BulkJobStatusEnum,
    DocumentTypeEnum,
)


class StudentProfile(BaseModel):
    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Educational background
    highest_qualification: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    institution_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    graduation_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    percentage_or_cgpa: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    stream: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)

    registration_source: Mapped[RegistrationSourceEnum] = mapped_column(
        String(30), default=RegistrationSourceEnum.STAFF
    )
    photo_consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Duplicate detection helper fields
    duplicate_check_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    # Phase 2 (Student Portal) additive fields - merged into the same table
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    branch: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    batch_year: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    skills: Mapped[Optional[list]] = mapped_column(ARRAY(String), default=list, nullable=True)
    resume_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="student_profile", foreign_keys=[user_id])
    course: Mapped[Optional["Course"]] = relationship("Course")
    batch: Mapped[Optional["Batch"]] = relationship("Batch")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="student_profile", cascade="all, delete-orphan")


class Document(BaseModel):
    __tablename__ = "documents"

    student_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False
    )
    document_type: Mapped[DocumentTypeEnum] = mapped_column(String(30), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    student_profile: Mapped["StudentProfile"] = relationship("StudentProfile", back_populates="documents")


class RegistrationInvite(BaseModel):
    __tablename__ = "registration_invites"

    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    status: Mapped[InviteStatusEnum] = mapped_column(String(20), default=InviteStatusEnum.PENDING)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    used_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class BulkUploadJob(BaseModel):
    __tablename__ = "bulk_upload_jobs"

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[BulkJobStatusEnum] = mapped_column(String(20), default=BulkJobStatusEnum.PENDING)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    error_report: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class SignInLog(BaseModel):
    __tablename__ = "sign_in_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="success")  # success | failed
