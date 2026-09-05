"""Canonical shared tables: assessments, questions, results, coding_questions,
test_cases, coding_submissions, ai_usage, chat_history.

These tables are used across the Student, Faculty, HR/Placement, and Admin
portals. This is the single, authoritative definition — do not redeclare
these tables elsewhere.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Text, DateTime, ForeignKey, JSON, Boolean, Float, func
)
from app.core.db_types import UUID, ARRAY

from app.core.database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=True)
    question_text = Column(Text, nullable=False)
    type = Column(String(30), nullable=False)  # mcq | coding | sql | descriptive
    data = Column(JSON, nullable=True)  # options / marking-scheme etc.
    marks = Column(Integer, nullable=False, default=1)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_bank_item = Column(Boolean, nullable=False, default=True)
    tags = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(30), nullable=False)
    question_ids = Column(JSON, nullable=False, default=list)
    batch_ids = Column(JSON, nullable=True, default=list)
    duration = Column(Integer, nullable=False, default=60)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    active_from = Column(DateTime(timezone=True), nullable=True)
    active_until = Column(DateTime(timezone=True), nullable=True)
    max_violations = Column(Integer, nullable=False, default=10)  # terminate after this many proctoring violations
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def is_currently_active(self) -> bool:
        """True only if manually active AND (no schedule, or within the schedule window)."""
        if not self.is_active:
            return False
        now = datetime.utcnow()
        if self.active_from and now < self.active_from.replace(tzinfo=None):
            return False
        if self.active_until and now > self.active_until.replace(tzinfo=None):
            return False
        return True


class Result(Base):
    __tablename__ = "results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=True)
    status = Column(String(30), nullable=False, default="in_progress")
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    violation_count = Column(Integer, nullable=False, default=0)
    is_flagged = Column(Boolean, nullable=False, default=False)
    is_terminated = Column(Boolean, nullable=False, default=False)
    termination_reason = Column(String(200), nullable=True)
    last_violation_reason = Column(String(200), nullable=True)  # English description of the most recent violation
    last_violation_severity = Column(String(20), nullable=True)  # "low" (tab switch) | "high" (phone / multiple people)
    help_requested = Column(Boolean, nullable=False, default=False)
    help_message = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)


class StudentAnswer(Base):
    __tablename__ = "student_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id = Column(UUID(as_uuid=True), ForeignKey("results.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    answer_data = Column(JSON, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    marks_awarded = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CodingQuestion(Base):
    __tablename__ = "coding_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=True)
    starter_code = Column(Text, nullable=True)
    language = Column(String(50), nullable=False, default="python")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coding_question_id = Column(UUID(as_uuid=True), ForeignKey("coding_questions.id"), nullable=False)
    input = Column(Text, nullable=True)
    expected_output = Column(Text, nullable=True)
    is_hidden = Column(Boolean, nullable=False, default=False)


class CodingSubmission(Base):
    __tablename__ = "coding_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    coding_question_id = Column(UUID(as_uuid=True), ForeignKey("coding_questions.id"), nullable=False)
    code = Column(Text, nullable=True)
    language = Column(String(50), nullable=True)
    output = Column(Text, nullable=True)
    status = Column(String(30), nullable=True)
    score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AIUsage(Base):
    __tablename__ = "ai_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    module = Column(String(100), nullable=False)
    tokens_used = Column(Integer, nullable=False, default=0)
    cost = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChatHistory(Base):
    """Serves two distinct conversation kinds, distinguished by whether the
    thread columns are set:

    1. AI Assistant chat (app.repositories.ai_repo.AIRepo.log_chat) -
       `user_id` = the human, `response` = the model's reply,
       `faculty_id` / `student_id` are both NULL.
    2. Faculty <-> Student direct messages (ChatRepository) - `user_id` =
       the SENDER, and `faculty_id` + `student_id` together identify the
       thread. Both are always set.

    Filtering a faculty<->student thread on `user_id` alone (the previous
    behaviour) leaked messages across different students AND pulled in both
    parties' private AI-assistant history, so every thread read must filter
    on the (faculty_id, student_id) pair instead.
    """
    __tablename__ = "chat_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)  # sender
    faculty_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Backward-compat alias: phase4/phase5 stub code imported this class as `AiUsage`.
AiUsage = AIUsage



class ProctorSnapshot(Base):
    """Webcam frame captured during an assessment attempt.
    Faculty/Admin can review these from the monitoring dashboard."""
    __tablename__ = "proctor_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id = Column(UUID(as_uuid=True), ForeignKey("results.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)
    image_path = Column(String(500), nullable=False)
    violation_count = Column(Integer, nullable=False, default=0)
    captured_at = Column(DateTime(timezone=True), server_default=func.now())
