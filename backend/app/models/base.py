import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, func
from app.core.db_types import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BaseModel(Base):
    """Abstract base for models declared with SQLAlchemy 2.0 `Mapped` style
    (used by the Foundation / Registration models)."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class BaseModelMixin:
    """Plain mixin for models declared with classic `Column(...)` style
    (used by the Student / Faculty / Admin+Analytics models). Mix in
    alongside `Base`, e.g. `class Foo(Base, BaseModelMixin): ...`"""

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
