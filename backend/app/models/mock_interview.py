from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float
from app.core.db_types import UUID

from app.db.session import Base
from app.models.mixins import BaseModelMixin


class MockInterview(Base, BaseModelMixin):
    __tablename__ = "mock_interviews"

    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    scheduled_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    scheduled_at = Column(DateTime, nullable=False)
    mode = Column(String(20), nullable=False, default="text")  # text | audio | video
    status = Column(String(20), nullable=False, default="scheduled")  # scheduled|in_progress|completed|cancelled
    recording_url = Column(String(1024), nullable=True)  # Azure Blob URL, populated after upload


class MockInterviewQnA(Base, BaseModelMixin):
    __tablename__ = "mock_interview_qna"

    mock_interview_id = Column(UUID(as_uuid=True), ForeignKey("mock_interviews.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=True)
    sequence = Column(String(10), nullable=False, default="1")


class MockInterviewEvaluation(Base, BaseModelMixin):
    __tablename__ = "mock_interview_evaluation"

    mock_interview_id = Column(UUID(as_uuid=True), ForeignKey("mock_interviews.id"), nullable=False, unique=True)
    confidence_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    technical_score = Column(Float, nullable=True)
    overall_score = Column(Float, nullable=True)
    max_score = Column(Float, nullable=True, default=100)  # custom total (e.g. /10, /50) — not fixed to /100
    feedback_text = Column(Text, nullable=True)
    improvement_suggestions = Column(Text, nullable=True)
