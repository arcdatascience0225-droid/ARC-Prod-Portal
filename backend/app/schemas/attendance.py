from datetime import date, datetime
from typing import Optional, List, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

AttendanceStatus = Literal["present", "absent", "late"]


class AttendanceEntry(BaseModel):
    studentId: UUID
    status: AttendanceStatus


class AttendanceMarkRequest(BaseModel):
    batchId: UUID
    date: date
    entries: List[AttendanceEntry]
    method: Literal["manual", "face_recognition"] = "manual"


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    batchId: UUID
    studentId: UUID
    date: date
    status: str
    method: str
    markedBy: UUID
    createdAt: datetime


class AttendanceFaceRecognitionHook(BaseModel):
    """
    Placeholder payload used to call the (separately built) face-recognition
    attendance service. This module only defines the contract and forwards
    the call; the actual face-matching logic lives in its own service/phase.
    """
    batchId: UUID
    date: date
    imageUrl: Optional[str] = None
