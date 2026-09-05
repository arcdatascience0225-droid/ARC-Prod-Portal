"""New tables added by the Student Portal module (learning, practice,
certificates). `StudentProfile` now lives in app.models.registration
(merged with the Foundation module's profile fields) and is re-exported
here for backward compatibility. `Attendance` now lives in
app.models.attendance (canonical batch-based version) and `Notification`
now lives in app.models.admin_platform (canonical broadcast-capable
version) - both re-exported here too so existing imports keep working.
"""
import uuid
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, func
)
from app.core.db_types import UUID, JSONB
from app.core.database import Base
from app.models.base import BaseModelMixin

# Backward-compat re-exports (see module docstring)
from app.models.registration import StudentProfile  # noqa: F401
from app.models.attendance import Attendance  # noqa: F401
from app.models.admin_platform import Notification  # noqa: F401


class StudentCertificate(Base, BaseModelMixin):
    __tablename__ = "student_certificates"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    issuer = Column(String(255))
    issue_date = Column(DateTime(timezone=True))
    certificate_url = Column(String(500))


# ---------- Learning Module ----------
class Syllabus(Base, BaseModelMixin):
    __tablename__ = "syllabus_items"

    course_id = Column(UUID(as_uuid=True), index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    order_index = Column(Integer, default=0)
    module = Column(String(255))


class SyllabusProgress(Base, BaseModelMixin):
    __tablename__ = "syllabus_progress"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    syllabus_item_id = Column(UUID(as_uuid=True), ForeignKey("syllabus_items.id"), nullable=False, index=True)
    status = Column(String(20), default="pending")  # pending | in_progress | completed
    completed_at = Column(DateTime(timezone=True))


class Lecture(Base, BaseModelMixin):
    __tablename__ = "lectures"

    syllabus_item_id = Column(UUID(as_uuid=True), ForeignKey("syllabus_items.id"), index=True)
    title = Column(String(255), nullable=False)
    video_url = Column(String(500))
    notes_url = Column(String(500))
    duration_minutes = Column(Integer)


class Assignment(Base, BaseModelMixin):
    __tablename__ = "assignments"

    title = Column(String(255), nullable=False)
    description = Column(Text)
    syllabus_item_id = Column(UUID(as_uuid=True), ForeignKey("syllabus_items.id"))
    due_date = Column(DateTime(timezone=True))
    max_marks = Column(Float, default=100)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class AssignmentSubmission(Base, BaseModelMixin):
    __tablename__ = "assignment_submissions"

    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    submission_type = Column(String(20))  # document | archive | notebook | repo_link
    file_url = Column(String(500))
    repo_link = Column(String(500))
    status = Column(String(20), default="submitted")  # submitted | reviewed | resubmit
    faculty_feedback = Column(Text)
    marks_obtained = Column(Float)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True))


class PracticeQuestion(Base, BaseModelMixin):
    __tablename__ = "practice_questions"

    topic = Column(String(255))
    question_text = Column(Text, nullable=False)
    type = Column(String(30))  # mcq | coding | sql | text
    data = Column(JSONB)  # options, correct_answer, difficulty etc.
    difficulty = Column(String(20), default="medium")


class DailyChallenge(Base, BaseModelMixin):
    __tablename__ = "daily_challenges"

    challenge_date = Column(DateTime(timezone=True), nullable=False, index=True)
    practice_question_id = Column(UUID(as_uuid=True), ForeignKey("practice_questions.id"))


class DailyChallengeAttempt(Base, BaseModelMixin):
    __tablename__ = "daily_challenge_attempts"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    daily_challenge_id = Column(UUID(as_uuid=True), ForeignKey("daily_challenges.id"), nullable=False, index=True)
    answer_text = Column(Text)
    is_correct = Column(Boolean)
    solved_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------- AI review of code submissions (extends coding_submissions) ----------
class CodeReview(Base, BaseModelMixin):
    __tablename__ = "code_reviews"

    coding_submission_id = Column(UUID(as_uuid=True), ForeignKey("coding_submissions.id"), nullable=False, index=True)
    review_text = Column(Text)
    suggestions = Column(JSONB)
    quality_score = Column(Float)
