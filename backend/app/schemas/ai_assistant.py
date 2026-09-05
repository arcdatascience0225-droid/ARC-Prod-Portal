from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    sessionContext: Optional[list[dict[str, str]]] = None


class ChatResponse(BaseModel):
    response: str
    tokensUsed: int


class ResumeGenerateRequest(BaseModel):
    profile: dict[str, Any]
    achievements: list[str] = []
    targetRole: Optional[str] = None


class ResumeOut(BaseModel):
    id: UUID
    content: dict
    aiGeneratedText: Optional[str]
    version: int


class ResumeImproveRequest(BaseModel):
    resumeText: str
    targetRole: Optional[str] = None


class CareerGuidanceRequest(BaseModel):
    question: str
    interestArea: Optional[str] = None


class StudyPlanRequest(BaseModel):
    goal: str
    currentLevel: Optional[str] = None
    hoursPerWeek: Optional[int] = 5


class StudyPlanOut(BaseModel):
    id: UUID
    goal: str
    planData: dict


class StrengthWeaknessOut(BaseModel):
    strengths: list[str]
    weaknesses: list[str]
    recommendation: str
    careerReadinessScore: float
