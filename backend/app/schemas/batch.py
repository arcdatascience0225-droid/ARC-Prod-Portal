from datetime import date, datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BatchCreate(BaseModel):
    name: str
    course: Optional[str] = None
    facultyId: Optional[UUID] = None
    trainerId: Optional[UUID] = None
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    batchTime: Optional[str] = None


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    name: str
    course: Optional[str] = None
    facultyId: UUID
    trainerId: Optional[UUID] = None
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    batchTime: Optional[str] = None
    createdAt: datetime
    studentCount: Optional[int] = 0


class StudentInBatch(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    name: str
    email: str


class AddStudentsToBatch(BaseModel):
    studentIds: List[UUID]
