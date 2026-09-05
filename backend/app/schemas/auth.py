from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class RegisterRequest(BaseModel):
    """Public self-registration payload. Intentionally has NO `role` field:
    anyone can hit /auth/register unauthenticated, so accepting a caller-supplied
    role would let anyone mint themselves an Admin/Faculty/HR account. Public
    registration always creates a Student account; staff accounts can only be
    created by a Super Admin via POST /admin/users (see admin_platform.py)."""
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    phone: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"


class RefreshRequest(BaseModel):
    refreshToken: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str = Field(min_length=8)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    name: str
    email: str
    role: str
    phone: Optional[str] = None
    isActive: bool
    permissions: Optional[list[str]] = None  # effective list: custom override if set, else role default


class ChangePasswordRequest(BaseModel):
    oldPassword: str
    newPassword: str = Field(min_length=8)
