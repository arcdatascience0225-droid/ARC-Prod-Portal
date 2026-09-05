from datetime import datetime
from typing import Optional, List, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AssessmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: Literal["mcq", "coding", "sql", "descriptive", "mixed"]
    questionIds: List[UUID]
    duration: int  # minutes
    batchIds: Optional[List[UUID]] = None
    activeFrom: Optional[datetime] = None
    activeUntil: Optional[datetime] = None
    maxViolations: int = 10  # terminate the attempt after this many proctoring violations


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    title: str
    description: Optional[str] = None
    type: str
    questionIds: List[UUID]
    batchIds: Optional[List[UUID]] = None
    duration: int
    createdBy: UUID
    createdAt: datetime
    questionCount: Optional[int] = 0
    isActive: bool = True
    activeFrom: Optional[datetime] = None
    activeUntil: Optional[datetime] = None
    maxViolations: int = 10
