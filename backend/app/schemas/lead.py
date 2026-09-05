from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class LeadCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    courseInterested: Optional[str] = None
    requirement: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    courseInterested: Optional[str] = None
    requirement: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    courseInterested: Optional[str] = None
    requirement: Optional[str] = None
    source: Optional[str] = None
    status: str
    notes: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
