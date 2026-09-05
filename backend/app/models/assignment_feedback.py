from sqlalchemy import Column, Text, Float, ForeignKey
from app.core.db_types import UUID

from app.db.session import Base
from app.models.mixins import BaseModelMixin


class AssignmentFeedback(Base, BaseModelMixin):
    __tablename__ = "assignment_feedback"

    result_id = Column(UUID(as_uuid=True), ForeignKey("results.id"), nullable=False)
    faculty_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    feedback_text = Column(Text, nullable=False)
    score_override = Column(Float, nullable=True)
