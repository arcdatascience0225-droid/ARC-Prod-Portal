from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StudentPerformanceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    studentId: UUID
    studentName: str
    assessmentsTaken: int
    averageScore: float
    highestScore: float
    lowestScore: float


class LeaderboardEntry(BaseModel):
    rank: int
    studentId: UUID
    studentName: str
    totalScore: float


class BatchAnalytics(BaseModel):
    batchId: UUID
    batchName: str
    totalStudents: int
    averageScore: float
    topPerformers: List[LeaderboardEntry]
    weakStudents: List[LeaderboardEntry]
    leaderboard: List[LeaderboardEntry]


class AssignmentFeedbackCreate(BaseModel):
    resultId: UUID
    feedbackText: str
    scoreOverride: Optional[float] = None


class AssignmentFeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    resultId: UUID
    facultyId: UUID
    feedbackText: str
    scoreOverride: Optional[float] = None
