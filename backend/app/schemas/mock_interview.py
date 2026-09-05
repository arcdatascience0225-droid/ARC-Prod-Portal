from datetime import datetime
from typing import Optional, List, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

InterviewMode = Literal["text", "audio", "video"]
InterviewStatus = Literal["scheduled", "in_progress", "completed", "cancelled"]


class MockInterviewSchedule(BaseModel):
    studentId: UUID
    batchId: Optional[UUID] = None
    scheduledAt: datetime
    mode: InterviewMode = "text"


class MockInterviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    studentId: UUID
    scheduledBy: UUID
    batchId: Optional[UUID] = None
    scheduledAt: datetime
    mode: str
    status: str
    recordingUrl: Optional[str] = None


class QnAEntry(BaseModel):
    questionText: str
    answerText: Optional[str] = None
    sequence: str = "1"


class MockInterviewSubmit(BaseModel):
    responses: List[QnAEntry]
    recordingUrl: Optional[str] = None  # Azure Blob URL if audio/video was recorded


class MockInterviewEvaluationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    mockInterviewId: UUID
    confidenceScore: Optional[float] = None
    communicationScore: Optional[float] = None
    technicalScore: Optional[float] = None
    overallScore: Optional[float] = None
    feedbackText: Optional[str] = None
    improvementSuggestions: Optional[str] = None
