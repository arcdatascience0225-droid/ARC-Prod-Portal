from typing import Optional
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


def _require_ref(value, field_name: str) -> str:
    """Course/batch references arrive as strings from the frontend selects,
    which send "" (not null) when nothing is chosen - an empty string silently
    satisfied the old `Optional[str]` typing, so blanks are rejected here.

    The value itself is only checked for emptiness: RegistrationService
    resolves it against the database and accepts a UUID, a course code/name or
    a batch name, reporting exactly what didn't match. Enforcing UUID syntax at
    this layer would reject valid human-readable references before the resolver
    ever sees them."""
    if value is None or str(value).strip() == "":
        raise ValueError(f"{field_name} is required")
    return str(value).strip()


class StudentRegisterByStaffRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: Optional[str] = None  # if empty, auto-generated & emailed
    dateOfBirth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    highestQualification: Optional[str] = None
    institutionName: Optional[str] = None
    graduationYear: Optional[int] = None
    percentageOrCgpa: Optional[str] = None
    stream: Optional[str] = None
    # Course + batch assignment is mandatory: a student with no batch is
    # invisible to attendance, performance, reports and announcements.
    courseId: str
    batchId: str
    photoConsentGiven: bool = False

    @field_validator("courseId")
    @classmethod
    def _check_course(cls, v):
        return _require_ref(v, "courseId")

    @field_validator("batchId")
    @classmethod
    def _check_batch(cls, v):
        return _require_ref(v, "batchId")


class StudentSelfRegisterRequest(BaseModel):
    inviteToken: str
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    phone: Optional[str] = None
    dateOfBirth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    highestQualification: Optional[str] = None
    institutionName: Optional[str] = None
    graduationYear: Optional[int] = None
    percentageOrCgpa: Optional[str] = None
    stream: Optional[str] = None
    photoConsentGiven: bool = False


class CreateInviteRequest(BaseModel):
    email: Optional[EmailStr] = None
    # The invite carries the course/batch that the self-registering student
    # inherits, so it has to be pinned down at invite-creation time.
    courseId: str
    batchId: str
    expiresInHours: int = Field(default=72, gt=0, le=24 * 30)

    @field_validator("courseId")
    @classmethod
    def _check_course(cls, v):
        return _require_ref(v, "courseId")

    @field_validator("batchId")
    @classmethod
    def _check_batch(cls, v):
        return _require_ref(v, "batchId")


class InviteOut(BaseModel):
    token: str
    inviteLink: str
    expiresAt: datetime


class StudentProfileOut(BaseModel):
    id: str
    userId: str
    name: str
    email: str
    phone: Optional[str] = None
    dateOfBirth: Optional[date] = None
    gender: Optional[str] = None
    courseId: Optional[str] = None
    batchId: Optional[str] = None
    registrationSource: str
    photoConsentGiven: bool
    isDuplicateSuspect: bool = False


class DuplicateCheckResult(BaseModel):
    isDuplicate: bool
    matchedUserIds: list[str] = []


class BulkUploadResult(BaseModel):
    jobId: str
    totalRows: int
    successCount: int
    failedCount: int
    errors: list[str] = []


class CourseOut(BaseModel):
    id: str
    name: str
    code: str


class BatchOut(BaseModel):
    id: str
    name: str
    courseId: str
