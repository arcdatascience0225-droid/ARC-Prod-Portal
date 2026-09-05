import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.user_repository import UserRepository
from app.repositories.registration_repository import RegistrationRepository
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
)
from app.core.config import settings
from app.core.redis_client import blacklist_token
from app.models.enums import RoleEnum
from app.utils.email import send_reset_password_email, send_welcome_email


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.reg_repo = RegistrationRepository(db)

    def register(self, name: str, email: str, password: str, phone: str | None = None, role: str = "student"):
        email = email.lower().strip()
        if self.user_repo.get_by_email(email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        if role not in [r.value for r in RoleEnum]:
            role = RoleEnum.STUDENT.value

        # Self-service public registration is restricted to student/guest role only
        if role not in (RoleEnum.STUDENT.value, RoleEnum.GUEST.value):
            role = RoleEnum.STUDENT.value

        user = self.user_repo.create(
            name=name,
            email=email,
            password_hash=hash_password(password),
            phone=phone,
            role=role,
        )
        send_welcome_email(email, name)
        return user

    def authenticate(self, email: str, password: str, ip_address: str | None = None, user_agent: str | None = None):
        email = email.lower().strip()
        user = self.user_repo.get_by_email(email)

        if not user or not verify_password(password, user.password_hash):
            if user:
                self.reg_repo.add_sign_in_log(
                    user_id=user.id, ip_address=ip_address, user_agent=user_agent, status="failed"
                )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

        self.user_repo.update(user, last_login_at=datetime.now(timezone.utc))
        self.reg_repo.add_sign_in_log(user_id=user.id, ip_address=ip_address, user_agent=user_agent, status="success")

        access_token = create_access_token(str(user.id), user.role)
        refresh_token = create_refresh_token(str(user.id))
        return user, access_token, refresh_token

    def refresh_access_token(self, refresh_token: str):
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

        user_id = payload.get("sub")
        user = self.user_repo.get_by_id(uuid.UUID(user_id))
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

        new_access_token = create_access_token(str(user.id), user.role)
        new_refresh_token = create_refresh_token(str(user.id))
        return new_access_token, new_refresh_token

    def forgot_password(self, email: str):
        email = email.lower().strip()
        user = self.user_repo.get_by_email(email)
        if not user:
            # Do not reveal whether email exists
            return
        token = create_reset_token(str(user.id))
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        send_reset_password_email(email, reset_link)

    def reset_password(self, token: str, new_password: str):
        try:
            payload = decode_token(token)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

        if payload.get("type") != "reset":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token type")

        user = self.user_repo.get_by_id(uuid.UUID(payload.get("sub")))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        self.user_repo.update(user, password_hash=hash_password(new_password), must_change_password=False)

    def change_password(self, user, old_password: str, new_password: str):
        if not verify_password(old_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")
        self.user_repo.update(user, password_hash=hash_password(new_password), must_change_password=False)

    def logout(self, access_token_payload: dict):
        """Blacklists the current access token's jti until its natural expiry."""
        jti = access_token_payload.get("jti")
        exp = access_token_payload.get("exp")
        if jti and exp:
            remaining = int(exp - datetime.now(timezone.utc).timestamp())
            blacklist_token(jti, remaining)
