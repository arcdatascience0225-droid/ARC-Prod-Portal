from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserListItem(BaseModel):
    id: str
    name: str
    email: str
    role: str
    isActive: bool
    createdAt: datetime
    batchName: Optional[str] = None


class ChangeRoleRequest(BaseModel):
    role: str


class RevokeAccessRequest(BaseModel):
    isActive: bool


class SignInLogOut(BaseModel):
    id: str
    userId: str
    userEmail: Optional[str] = None
    ipAddress: Optional[str] = None
    userAgent: Optional[str] = None
    status: str
    createdAt: datetime
