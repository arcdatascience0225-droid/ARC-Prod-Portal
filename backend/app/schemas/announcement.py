from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1)
    message: str = Field(min_length=1)
    batchIds: List[UUID] = Field(min_length=1)
    # Delivery channel, matching the notifications module's vocabulary.
    channel: str = "in_app"

    @field_validator("batchIds")
    @classmethod
    def _dedupe_batches(cls, v: List[UUID]) -> List[UUID]:
        seen, out = set(), []
        for b in v:
            if b not in seen:
                seen.add(b)
                out.append(b)
        return out

    @field_validator("channel")
    @classmethod
    def _valid_channel(cls, v: str) -> str:
        allowed = {"in_app", "email", "sms", "push"}
        if v not in allowed:
            raise ValueError(f"channel must be one of {sorted(allowed)}")
        return v


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    title: str
    message: str
    facultyId: UUID
    createdAt: datetime
    batchIds: Optional[List[UUID]] = None
    # How many users actually received a notification row for this broadcast.
    recipientCount: Optional[int] = None
    notificationId: Optional[UUID] = None


class ChatMessageCreate(BaseModel):
    studentId: UUID
    message: str = Field(min_length=1)


class StudentChatMessageCreate(BaseModel):
    """Student -> faculty direction."""
    facultyId: UUID
    message: str = Field(min_length=1)


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    userId: UUID          # kept for backward compatibility - same as senderId
    senderId: UUID
    facultyId: Optional[UUID] = None
    studentId: Optional[UUID] = None
    sentByStudent: bool = False
    message: str
    response: Optional[str] = None
    createdAt: datetime
