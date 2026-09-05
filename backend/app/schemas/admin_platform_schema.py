from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    isActive: bool = True
    createdAt: datetime
    batchName: Optional[str] = None
    hasCustomPermissions: bool = False


class UserListResponse(BaseModel):
    """Paged envelope. Two frontend clients hit GET /admin/users with
    different expectations - one wanted a bare array, the other {total, items}.
    The envelope is now canonical and the array-consuming client unwraps
    `.items`."""
    total: int
    items: list[UserOut]


class UserToggleAccess(BaseModel):
    is_active: bool


class UserUpdateRole(BaseModel):
    role: str


class UserCreateByAdmin(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str


class CourseCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    durationWeeks: int = 0


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    code: str
    description: Optional[str]
    duration_weeks: int
    created_at: datetime


class BatchCreate(BaseModel):
    courseId: UUID
    name: str
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    facultyId: Optional[UUID] = None
    trainerId: Optional[UUID] = None


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    course_id: UUID
    name: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    status: str
    facultyName: Optional[str] = None


class PaymentCreate(BaseModel):
    userId: UUID
    batchId: Optional[UUID] = None
    amount: float
    currency: str = "INR"
    paymentMethod: Optional[str] = None
    transactionId: Optional[str] = None


class PaymentUpdateStatus(BaseModel):
    status: str


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    batch_id: Optional[UUID]
    amount: float
    currency: str
    status: str
    payment_method: Optional[str]
    created_at: datetime


class SettingUpsert(BaseModel):
    key: str
    value: dict[str, Any]


class SettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    key: str
    value: dict
    updated_at: datetime


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: Optional[UUID]
    action: str
    module: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    details: dict
    created_at: datetime


class AIUsageSummary(BaseModel):
    module: str
    totalTokens: int
    totalCost: float
    requestCount: int
