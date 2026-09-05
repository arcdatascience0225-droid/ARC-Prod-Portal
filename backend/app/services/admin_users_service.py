import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.user_repository import UserRepository
from app.repositories.registration_repository import RegistrationRepository
from app.core.security import hash_password
from app.models.enums import RoleEnum


class AdminService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.reg_repo = RegistrationRepository(db)

    def list_users(self, skip: int, limit: int, role: str | None, search: str | None):
        return self.user_repo.list_all(skip=skip, limit=limit, role=role, search=search)

    def create_staff_user(self, name: str, email: str, role: str, password: str, created_by: uuid.UUID):
        if role not in [r.value for r in RoleEnum]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
        if self.user_repo.get_by_email(email.lower().strip()):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        return self.user_repo.create(
            name=name,
            email=email.lower().strip(),
            password_hash=hash_password(password),
            role=role,
            must_change_password=True,
            created_by=created_by,
        )

    def change_role(self, user_id: uuid.UUID, new_role: str, acting_user):
        if new_role not in [r.value for r in RoleEnum]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if new_role == RoleEnum.SUPER_ADMIN.value and acting_user.role != RoleEnum.SUPER_ADMIN.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a Super Admin can assign the Super Admin role")

        return self.user_repo.update(user, role=new_role)

    def set_active_status(self, user_id: uuid.UUID, is_active: bool):
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return self.user_repo.update(user, is_active=is_active)

    def get_sign_in_logs(self, skip: int, limit: int, user_id: uuid.UUID | None = None):
        return self.reg_repo.list_sign_in_logs(skip=skip, limit=limit, user_id=user_id)

    def assign_student_to_batch(self, user_id: uuid.UUID, course_ref: str, batch_ref: str):
        from app.services.registration_service import RegistrationService
        from app.models.enums import RegistrationSourceEnum

        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if user.role != RoleEnum.STUDENT.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only student accounts can be enrolled in a batch")

        reg_service = RegistrationService(self.db)
        course_uuid, batch_uuid = reg_service._validate_course_and_batch(course_ref, batch_ref)

        profile = self.reg_repo.get_profile_by_user_id(user_id)
        if profile:
            profile.course_id = course_uuid
            profile.batch_id = batch_uuid
            self.db.commit()
        else:
            # Public /auth/register never creates a student_profiles row at
            # all, so this student has none yet — create a minimal one now.
            self.reg_repo.create_profile(
                user_id=user_id,
                course_id=course_uuid,
                batch_id=batch_uuid,
                registration_source=RegistrationSourceEnum.STAFF.value,
            )

        reg_service._enrol_in_batch(user_id, batch_uuid)
