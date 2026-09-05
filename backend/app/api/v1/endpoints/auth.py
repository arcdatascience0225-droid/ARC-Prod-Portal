from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, bearer_scheme
from app.core.security import decode_token
from app.services.auth_service import AuthService
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    UserOut,
)
from app.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=201)  # ACC-002
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    # Security: this endpoint is public/unauthenticated. Role is hard-coded to
    # "student" (not taken from the request) so nobody can self-register as
    # Admin/Faculty/HR/etc. Staff accounts can only be created by a Super
    # Admin via POST /admin/users.
    user = AuthService(db).register(payload.name, payload.email, payload.password, payload.phone, "student")
    return UserOut(id=str(user.id), name=user.name, email=user.email, role=user.role, phone=user.phone, isActive=user.is_active)


@router.post("/login", response_model=TokenResponse)  # ACC-001
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    user, access_token, refresh_token = AuthService(db).authenticate(payload.email, payload.password, ip, ua)
    return TokenResponse(accessToken=access_token, refreshToken=refresh_token)


@router.post("/refresh", response_model=TokenResponse)  # ACC-003
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    access_token, refresh_token = AuthService(db).refresh_access_token(payload.refreshToken)
    return TokenResponse(accessToken=access_token, refreshToken=refresh_token)


@router.post("/forgot-password", status_code=204)  # ACC-004
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    AuthService(db).forgot_password(payload.email)
    return


@router.post("/reset-password", status_code=204)  # ACC-005
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    AuthService(db).reset_password(payload.token, payload.newPassword)
    return


@router.post("/change-password", status_code=204)  # ACC-006
def change_password(payload: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuthService(db).change_password(current_user, payload.oldPassword, payload.newPassword)
    return


@router.post("/logout", status_code=204)  # ACC-007
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme), db: Session = Depends(get_db)):
    payload = decode_token(credentials.credentials)
    AuthService(db).logout(payload)
    return


@router.get("/me", response_model=UserOut)  # ACC-008
def get_me(current_user: User = Depends(get_current_user)):
    from app.core.permissions_catalog import default_permissions_for_role
    effective_permissions = (
        current_user.permissions if getattr(current_user, "permissions", None) is not None
        else default_permissions_for_role(current_user.role)
    )
    return UserOut(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        phone=current_user.phone,
        isActive=current_user.is_active,
        permissions=effective_permissions,
    )
