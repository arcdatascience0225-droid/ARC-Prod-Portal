from datetime import datetime
from typing import Optional, List, Any, Dict
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- Dashboard ----------
class DashboardResponse(CamelModel):
    welcome_name: str
    progress_percent: float
    attendance_percent: float
    upcoming_assessments: List["UpcomingAssessment"]
    recent_notifications: List["NotificationOut"]


class UpcomingAssessment(CamelModel):
    id: UUID
    title: str
    type: str
    duration: int
    starts_in_minutes: Optional[int] = None


class NotificationOut(CamelModel):
    id: UUID
    # Recipient row id - what PUT /notifications/mine/{id}/read expects.
    recipient_id: Optional[UUID] = None
    title: str
    message: Optional[str] = None
    type: str
    is_read: bool = False
    link: Optional[str] = None
    created_at: datetime


# ---------- Profile ----------
class StudentProfileOut(CamelModel):
    id: UUID
    user_id: UUID
    phone: Optional[str] = None
    bio: Optional[str] = None
    branch: Optional[str] = None
    batch_year: Optional[str] = None
    skills: List[str] = []
    resume_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    avatar_url: Optional[str] = None
    # Enrollment context — course/batch/faculty and rollup stats, populated
    # in StudentService.get_profile() (not stored on this table directly).
    course_name: Optional[str] = None
    batch_name: Optional[str] = None
    faculty_name: Optional[str] = None
    course_progress: Optional[float] = None
    average_percentile: Optional[float] = None


class StudentProfileUpdate(CamelModel):
    phone: Optional[str] = None
    bio: Optional[str] = None
    branch: Optional[str] = None
    batch_year: Optional[str] = None
    skills: Optional[List[str]] = None
    resume_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None


class CertificateOut(CamelModel):
    id: UUID
    title: str
    issuer: Optional[str] = None
    issue_date: Optional[datetime] = None
    certificate_url: Optional[str] = None


class CertificateCreate(CamelModel):
    title: str
    issuer: Optional[str] = None
    issue_date: Optional[datetime] = None
    certificate_url: Optional[str] = None


# ---------- Learning ----------
class SyllabusItemOut(CamelModel):
    id: UUID
    title: str
    description: Optional[str] = None
    module: Optional[str] = None
    order_index: int
    status: str = "pending"


class LectureOut(CamelModel):
    id: UUID
    title: str
    video_url: Optional[str] = None
    notes_url: Optional[str] = None
    duration_minutes: Optional[int] = None


class AssignmentOut(CamelModel):
    id: UUID
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    max_marks: float
    my_submission_status: Optional[str] = None


class AssignmentSubmissionCreate(CamelModel):
    assignment_id: UUID
    submission_type: str = Field(pattern="^(document|archive|notebook|repo_link)$")
    file_url: Optional[str] = None
    repo_link: Optional[str] = None


class AssignmentSubmissionOut(CamelModel):
    id: UUID
    assignment_id: UUID
    submission_type: str
    file_url: Optional[str] = None
    repo_link: Optional[str] = None
    status: str
    faculty_feedback: Optional[str] = None
    marks_obtained: Optional[float] = None
    submitted_at: datetime


class PracticeQuestionOut(CamelModel):
    id: UUID
    topic: Optional[str] = None
    question_text: str
    type: str
    difficulty: str
    data: Optional[Dict[str, Any]] = None


class DailyChallengeOut(CamelModel):
    id: UUID
    challenge_date: datetime
    question: PracticeQuestionOut
    already_attempted: bool = False


class DailyChallengeSubmit(CamelModel):
    answer_text: str


# ---------- Assessment ----------
class AssessmentListItem(CamelModel):
    id: UUID
    title: str
    type: str
    duration: int
    status: str  # upcoming | in_progress | completed


class QuestionForAttempt(CamelModel):
    id: UUID
    question_text: str
    type: str
    # MCQ choices only, in display order. Never contains the correct answer -
    # this payload goes straight to the student's browser.
    options: Optional[List[str]] = None
    marks: float
    # Coding/SQL questions only: visible (non-hidden) test cases so the
    # student knows the exact I/O contract (or schema + expected result)
    # before writing their answer.
    sample_test_cases: Optional[List["TestCaseOut"]] = None


class AssessmentAttemptOut(CamelModel):
    result_id: UUID
    assessment_id: UUID
    title: str
    duration: int
    started_at: datetime
    questions: List[QuestionForAttempt]


class AnswerSubmit(CamelModel):
    question_id: UUID
    answer_text: Optional[str] = None
    selected_option: Optional[str] = None


class AssessmentSubmit(CamelModel):
    result_id: UUID
    answers: List[AnswerSubmit]


class AssessmentResultOut(CamelModel):
    result_id: UUID
    assessment_id: UUID
    score: float
    max_score: float
    status: str
    percentile: Optional[float] = None
    rank: Optional[int] = None
    ai_feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None


class AvailableAssessmentOut(CamelModel):
    id: UUID
    title: str
    description: Optional[str] = None
    type: str
    duration: int
    question_count: int
    batch_name: Optional[str] = None


class AssessmentHistoryItem(CamelModel):
    result_id: UUID
    assessment_title: str
    type: str
    score: float
    max_score: Optional[float] = None
    status: str
    percentile: Optional[float] = None
    rank: Optional[int] = None
    submitted_at: Optional[datetime] = None


# ---------- Coding Lab ----------
class CodingQuestionOut(CamelModel):
    id: UUID
    question_id: UUID
    question_text: str
    starter_code: Optional[str] = None
    language: str
    marks: float
    sample_test_cases: List["TestCaseOut"] = []


class CodingQuestionListItem(CamelModel):
    id: UUID
    question_text: str
    language: str
    marks: float


class TestCaseOut(CamelModel):
    id: UUID
    input: str
    expected_output: str
    is_hidden: bool


class CodeRunRequest(CamelModel):
    coding_question_id: UUID
    code: str
    language: str
    custom_input: Optional[str] = None


class CodeRunResult(CamelModel):
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    status: str
    time: Optional[str] = None
    memory: Optional[int] = None


class CodeSubmitRequest(CamelModel):
    coding_question_id: UUID
    code: str
    language: str


class TestCaseResult(CamelModel):
    test_case_id: UUID
    passed: bool
    is_hidden: bool
    actual_output: Optional[str] = None
    expected_output: Optional[str] = None


class CodeSubmitResult(CamelModel):
    submission_id: UUID
    status: str  # accepted | partial | failed
    score: float
    total_test_cases: int
    passed_test_cases: int
    test_case_results: List[TestCaseResult]
    ai_review: Optional[str] = None


DashboardResponse.model_rebuild()
