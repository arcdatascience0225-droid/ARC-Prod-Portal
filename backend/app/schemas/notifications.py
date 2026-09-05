from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator

ALLOWED_CHANNELS = {"email", "sms", "in_app", "push"}


class NotificationCreate(BaseModel):
    title: str = Field(min_length=1)
    message: str = Field(min_length=1)
    type: str
    channel: str = "in_app"  # email, sms, in_app, push
    targetRoles: list[str] = []
    targetUsers: list[UUID] = []
    # Batch targeting: every enrolled student of these batches becomes a
    # recipient. Previously only role- and user-targeting existed here, which
    # is why batch-scoped announcements had to live in a separate, undelivered
    # subsystem.
    targetBatches: list[UUID] = []
    scheduledAt: Optional[datetime] = None

    @model_validator(mode="after")
    def _needs_a_target(self):
        if self.channel not in ALLOWED_CHANNELS:
            raise ValueError(f"channel must be one of {sorted(ALLOWED_CHANNELS)}")
        if not (self.targetRoles or self.targetUsers or self.targetBatches):
            raise ValueError("Provide at least one of targetRoles, targetUsers or targetBatches")
        return self


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    message: str
    type: str
    channel: str
    status: str
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    created_at: datetime


class NotificationRecipientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    notification_id: UUID
    is_read: bool
    delivered: bool
    created_at: datetime


class BroadcastRequest(BaseModel):
    title: str = Field(min_length=1)
    message: str = Field(min_length=1)
    roles: list[str] = []
    batchIds: list[UUID] = []
    channel: str = "in_app"

    @model_validator(mode="after")
    def _needs_a_target(self):
        if self.channel not in ALLOWED_CHANNELS:
            raise ValueError(f"channel must be one of {sorted(ALLOWED_CHANNELS)}")
        if not (self.roles or self.batchIds):
            raise ValueError("Provide at least one of roles or batchIds")
        return self
