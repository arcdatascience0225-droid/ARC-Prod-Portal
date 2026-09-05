"""Counsellor leads / enquiries — a prospective student's requirements
captured before they register (name, contact, what they're interested in,
follow-up status). Separate from the Placement `Application`/`Job` models,
which are for already-enrolled students applying to jobs.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime
from app.core.db_types import UUID
from app.core.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    course_interested = Column(String(255), nullable=True)
    requirement = Column(Text, nullable=True)  # free-text enquiry details
    source = Column(String(100), nullable=True)  # e.g. "walk-in", "referral", "website"
    status = Column(String(30), nullable=False, default="new")  # new/contacted/follow_up/converted/lost
    notes = Column(Text, nullable=True)
    assigned_to = Column(UUID(as_uuid=True), nullable=True)  # counsellor user id
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
