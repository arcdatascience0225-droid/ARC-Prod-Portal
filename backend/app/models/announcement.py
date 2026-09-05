from sqlalchemy import Column, String, Text, ForeignKey
from app.core.db_types import UUID

from app.db.session import Base
from app.models.mixins import BaseModelMixin


class Announcement(Base, BaseModelMixin):
    __tablename__ = "announcements"

    faculty_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)


class AnnouncementBatch(Base, BaseModelMixin):
    __tablename__ = "announcement_batches"

    announcement_id = Column(UUID(as_uuid=True), ForeignKey("announcements.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False)
