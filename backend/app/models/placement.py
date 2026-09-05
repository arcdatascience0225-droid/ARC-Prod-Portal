import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    Boolean,
    Numeric,
)
from app.core.db_types import UUID, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    industry = Column(String(150), nullable=True)
    website = Column(String(255), nullable=True)
    hr_contact_name = Column(String(150), nullable=True)
    hr_contact_email = Column(String(255), nullable=True)
    hr_contact_phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    jobs = relationship("Job", back_populates="company", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    required_skills = Column(JSONB, nullable=False, default=list)  # ["python","react",...]
    min_experience_years = Column(Integer, default=0)
    min_score_percent = Column(Float, default=0)  # min avg assessment score required
    job_type = Column(String(50), default="full_time")  # full_time/internship/contract
    location = Column(String(255), nullable=True)
    salary_min = Column(Numeric(12, 2), nullable=True)
    salary_max = Column(Numeric(12, 2), nullable=True)
    openings = Column(Integer, default=1)
    status = Column(String(30), default="open")  # open/closed/on_hold
    application_deadline = Column(DateTime, nullable=True)
    target_batch_ids = Column(JSONB, nullable=True, default=None)
    posted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="jobs")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")


class Application(Base):
    __tablename__ = "applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    match_score = Column(Float, nullable=True)  # AI computed 0-100
    match_reasoning = Column(Text, nullable=True)  # AI generated explanation
    status = Column(
        String(30), default="applied"
    )  # applied/shortlisted/interview/offer/rejected/placed/withdrawn
    applied_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    interviews = relationship("Interview", back_populates="application", cascade="all, delete-orphan")
    offer = relationship("Offer", back_populates="application", uselist=False, cascade="all, delete-orphan")


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False)
    round_name = Column(String(100), default="Technical Round 1")  # HR/Technical/Managerial
    scheduled_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=30)
    mode = Column(String(30), default="online")  # online/offline/mock_video
    meeting_link = Column(String(500), nullable=True)  # mock/actual video link
    interviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String(30), default="scheduled")  # scheduled/completed/cancelled/no_show
    recording_url = Column(String(500), nullable=True)  # mock structure for recorded interview
    transcript = Column(Text, nullable=True)  # for AI analysis input
    ai_score = Column(Float, nullable=True)  # 0-100 objective AI scoring
    ai_analysis = Column(JSONB, nullable=True)  # {strengths, weaknesses, summary}
    interviewer_feedback = Column(Text, nullable=True)
    interviewer_rating = Column(Integer, nullable=True)  # 1-5
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("Application", back_populates="interviews")


class Offer(Base):
    __tablename__ = "offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False, unique=True)
    designation = Column(String(255), nullable=False)
    salary_offered = Column(Numeric(12, 2), nullable=False)
    location = Column(String(255), nullable=True)
    joining_date = Column(DateTime, nullable=True)
    offer_letter_url = Column(String(500), nullable=True)  # Azure Blob URL
    status = Column(String(30), default="pending")  # pending/accepted/declined/withdrawn
    issued_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("Application", back_populates="offer")

