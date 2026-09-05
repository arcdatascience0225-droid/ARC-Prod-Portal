import uuid
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey
from app.core.db_types import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import RoleEnum


class User(BaseModel):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(String(50), nullable=False, default=RoleEnum.STUDENT)

    # Additional fields (allowed - additive only, core fields untouched)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[Optional[str]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # Per-user custom access override, set by Super Admin (e.g. via a
    # checkbox picker on Create/Edit User). Null means "use the default
    # access for this user's role" (unchanged legacy behavior). A non-null
    # list restricts the user to exactly those nav item paths, regardless
    # of what their role would normally see.
    permissions: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    student_profile: Mapped[Optional["StudentProfile"]] = relationship(
        "StudentProfile", back_populates="user", uselist=False, foreign_keys="StudentProfile.user_id",
        cascade="all, delete-orphan",
    )
