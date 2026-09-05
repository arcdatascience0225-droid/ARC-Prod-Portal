from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- Company ----------
class CompanyCreate(CamelModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    hr_contact_name: Optional[str] = None
    hr_contact_email: Optional[str] = None
    hr_contact_phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    notes: Optional[str] = None


class CompanyUpdate(CamelModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    hr_contact_name: Optional[str] = None
    hr_contact_email: Optional[str] = None
    hr_contact_phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    notes: Optional[str] = None


class CompanyOut(CamelModel):
    id: UUID
    name: str
    industry: Optional[str]
    website: Optional[str]
    hr_contact_name: Optional[str]
    hr_contact_email: Optional[str]
    hr_contact_phone: Optional[str]
    address: Optional[str]
    logo_url: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


# ---------- Job ----------
class JobCreate(CamelModel):
    company_id: UUID
    title: str
    description: str
    required_skills: List[str] = Field(default_factory=list)
    min_experience_years: int = 0
    min_score_percent: float = 0
    job_type: str = "full_time"
    location: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    openings: int = 1
    application_deadline: Optional[datetime] = None
    # If set, only students in these batches see this job.
    # Empty/null = visible to all students.
    target_batch_ids: Optional[List[UUID]] = None


class JobUpdate(CamelModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[List[str]] = None
    min_experience_years: Optional[int] = None
    min_score_percent: Optional[float] = None
    job_type: Optional[str] = None
    location: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    openings: Optional[int] = None
    status: Optional[str] = None
    application_deadline: Optional[datetime] = None
    target_batch_ids: Optional[List[UUID]] = None


class JobOut(CamelModel):
    id: UUID
    company_id: UUID
    company_name: Optional[str] = None
    title: str
    description: str
    required_skills: List[str]
    min_experience_years: int
    min_score_percent: float
    job_type: str
    location: Optional[str]
    salary_min: Optional[float]
    salary_max: Optional[float]
    openings: int
    status: str
    application_deadline: Optional[datetime]
    target_batch_ids: Optional[List[UUID]] = None
    posted_by: UUID
    created_at: datetime
    updated_at: datetime


# ---------- Matching ----------
class CandidateMatch(CamelModel):
    student_id: UUID
    student_name: str
    student_email: str
    match_score: float
    match_reasoning: str
    avg_assessment_score: Optional[float] = None
    skills_matched: List[str] = Field(default_factory=list)
    skills_missing: List[str] = Field(default_factory=list)


class MatchRunResponse(CamelModel):
    job_id: UUID
    total_candidates_evaluated: int
    matches: List[CandidateMatch]


# ---------- Application ----------
class ApplicationCreate(CamelModel):
    job_id: UUID


class ApplicationStatusUpdate(CamelModel):
    status: str  # applied/shortlisted/interview/offer/rejected/placed/withdrawn


class ApplicationOut(CamelModel):
    id: UUID
    job_id: UUID
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    student_id: UUID
    student_name: Optional[str] = None
    match_score: Optional[float]
    match_reasoning: Optional[str]
    status: str
    applied_at: datetime
    updated_at: datetime


# ---------- Interview ----------
class InterviewCreate(CamelModel):
    application_id: UUID
    round_name: str = "Technical Round 1"
    scheduled_at: datetime
    duration_minutes: int = 30
    mode: str = "online"
    meeting_link: Optional[str] = None
    interviewer_id: Optional[UUID] = None


class InterviewUpdate(CamelModel):
    round_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    mode: Optional[str] = None
    meeting_link: Optional[str] = None
    interviewer_id: Optional[UUID] = None
    status: Optional[str] = None
    recording_url: Optional[str] = None
    transcript: Optional[str] = None
    interviewer_feedback: Optional[str] = None
    interviewer_rating: Optional[int] = None


class InterviewAnalyzeRequest(CamelModel):
    transcript: str


class InterviewOut(CamelModel):
    id: UUID
    application_id: UUID
    round_name: str
    scheduled_at: datetime
    duration_minutes: int
    mode: str
    meeting_link: Optional[str]
    interviewer_id: Optional[UUID]
    status: str
    recording_url: Optional[str]
    transcript: Optional[str]
    ai_score: Optional[float]
    ai_analysis: Optional[Dict[str, Any]]
    interviewer_feedback: Optional[str]
    interviewer_rating: Optional[int]
    created_at: datetime
    updated_at: datetime


# ---------- Offer ----------
class OfferCreate(CamelModel):
    application_id: UUID
    designation: str
    salary_offered: float
    location: Optional[str] = None
    joining_date: Optional[datetime] = None
    offer_letter_url: Optional[str] = None


class OfferRespond(CamelModel):
    status: str  # accepted/declined


class OfferOut(CamelModel):
    id: UUID
    application_id: UUID
    designation: str
    salary_offered: float
    location: Optional[str]
    joining_date: Optional[datetime]
    offer_letter_url: Optional[str]
    status: str
    issued_at: datetime
    responded_at: Optional[datetime]


# ---------- Analytics ----------
class PlacementAnalytics(CamelModel):
    total_students: int
    total_applications: int
    total_interviews: int
    total_offers: int
    total_placed: int
    placement_rate_percent: float
    avg_salary_offered: Optional[float]
    highest_salary_offered: Optional[float]
    company_wise_hires: Dict[str, int]
    status_funnel: Dict[str, int]
