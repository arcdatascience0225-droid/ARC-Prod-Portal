import uuid
import hashlib
import secrets
import io
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.user_repository import UserRepository
from app.repositories.registration_repository import RegistrationRepository
from app.repositories.batch_repository import BatchRepository
from app.core.security import hash_password
from app.core.config import settings
from app.models.enums import RoleEnum, RegistrationSourceEnum, InviteStatusEnum, BulkJobStatusEnum, DocumentTypeEnum
from app.utils.email import send_invite_email, send_welcome_email
from app.utils.storage import upload_file_to_blob


def _dup_hash(name: str, email: str, phone: str | None, dob) -> str:
    raw = f"{name.strip().lower()}|{email.strip().lower()}|{(phone or '').strip()}|{dob or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()


class RegistrationService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.reg_repo = RegistrationRepository(db)
        self.batch_repo = BatchRepository(db)

    # ---------- Course / batch validation + enrolment ----------
    def _validate_course_and_batch(self, course_ref: str, batch_ref: str,
                                    course_field: str = "courseId", batch_field: str = "batchId"):
        """Resolve + validate a course/batch pair.

        `course_ref` accepts a UUID, the course code, or the course name;
        `batch_ref` accepts a UUID or the batch name. Requiring raw UUIDs made
        the spreadsheet upload unusable in practice - nobody filling in a CSV
        knows the internal ids - so human-readable references are resolved here
        instead. `course_field` / `batch_field` name the field in error
        messages so a CSV upload says `course_id` and the JSON API says
        `courseId`.
        """
        course_ref = str(course_ref or "").strip()
        batch_ref = str(batch_ref or "").strip()
        if not course_ref or not batch_ref:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"{course_field} and {batch_field} are required")

        course = self.reg_repo.find_course_by_ref(course_ref)
        if not course:
            known = ", ".join(
                f"{c.code} ({c.name})" for c in self.reg_repo.list_courses()[:10]
            ) or "none defined yet"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(f"No course matches {course_field}='{course_ref}'. "
                        f"Use the course code, name, or id. Available: {known}"),
            )

        batch = self.reg_repo.find_batch_by_ref(batch_ref, course_id=course.id)
        if not batch:
            known = ", ".join(
                b.name for b in self.reg_repo.list_batches_for_course(course.id)[:10]
            ) or f"none defined for course '{course.code}'"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(f"No batch matches {batch_field}='{batch_ref}' in course "
                        f"'{course.code}'. Use the batch name or id. Available: {known}"),
            )

        if batch.course_id != course.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Batch '{batch.name}' does not belong to course '{course.name}'",
            )
        return course.id, batch.id

    def _enrol_in_batch(self, user_id: uuid.UUID, batch_id: uuid.UUID) -> None:
        """Write the `batch_students` row.

        Registration used to only set `student_profiles.batch_id`, but every
        batch-scoped feature (faculty batch rosters, attendance, performance,
        reports, announcement delivery) reads `batch_students`. Without this
        row a registered student was assigned to a batch on paper and invisible
        everywhere else.
        """
        self.batch_repo.enroll_student(batch_id, user_id)

    # ---------- Duplicate detection (REG-011 equivalent) ----------
    def check_duplicate(self, name: str, email: str, phone: str | None = None, dob=None):
        if self.user_repo.get_by_email(email.lower().strip()):
            return True, []
        dup_hash = _dup_hash(name, email, phone, dob)
        matches = self.reg_repo.find_by_duplicate_hash(dup_hash)
        return (len(matches) > 0), [str(m.user_id) for m in matches]

    # ---------- Staff registers a student ----------
    def register_by_staff(self, payload, created_by_user_id: uuid.UUID):
        email = payload.email.lower().strip()
        if self.user_repo.get_by_email(email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

        course_uuid, batch_uuid = self._validate_course_and_batch(payload.courseId, payload.batchId)

        is_dup, matches = self.check_duplicate(payload.name, email, payload.phone, payload.dateOfBirth)
        temp_password = payload.password or secrets.token_urlsafe(9)

        user = self.user_repo.create(
            name=payload.name,
            email=email,
            password_hash=hash_password(temp_password),
            phone=payload.phone,
            role=RoleEnum.STUDENT.value,
            must_change_password=True,
            created_by=created_by_user_id,
        )

        profile = self.reg_repo.create_profile(
            user_id=user.id,
            date_of_birth=payload.dateOfBirth,
            gender=payload.gender,
            address=payload.address,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode,
            highest_qualification=payload.highestQualification,
            institution_name=payload.institutionName,
            graduation_year=payload.graduationYear,
            percentage_or_cgpa=payload.percentageOrCgpa,
            stream=payload.stream,
            course_id=course_uuid,
            batch_id=batch_uuid,
            registration_source=RegistrationSourceEnum.STAFF.value,
            photo_consent_given=payload.photoConsentGiven,
            photo_consent_at=datetime.now(timezone.utc) if payload.photoConsentGiven else None,
            duplicate_check_hash=_dup_hash(payload.name, email, payload.phone, payload.dateOfBirth),
        )

        self._enrol_in_batch(user.id, batch_uuid)

        send_welcome_email(email, payload.name, temp_password=temp_password)
        return user, profile, is_dup, matches

    # ---------- Self registration via invite ----------
    def create_invite(self, created_by_user_id: uuid.UUID, email: str | None, course_id: str, batch_id: str, expires_in_hours: int = 72):
        course_uuid, batch_uuid = self._validate_course_and_batch(course_id, batch_id)
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
        invite = self.reg_repo.create_invite(
            token=token,
            email=email.lower().strip() if email else None,
            course_id=course_uuid,
            batch_id=batch_uuid,
            status=InviteStatusEnum.PENDING.value,
            expires_at=expires_at,
            created_by=created_by_user_id,
        )
        invite_link = f"{settings.FRONTEND_URL}/register/invite?token={token}"
        if email:
            send_invite_email(email, invite_link)
        return invite, invite_link

    def validate_invite(self, token: str):
        invite = self.reg_repo.get_invite_by_token(token)
        if not invite:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite link")
        if invite.status != InviteStatusEnum.PENDING.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invite is {invite.status}")
        expires_at = invite.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            self.reg_repo.update_invite(invite, status=InviteStatusEnum.EXPIRED.value)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite link has expired")
        return invite

    def register_via_invite(self, payload):
        invite = self.validate_invite(payload.inviteToken)
        if invite.email and invite.email != payload.email.lower().strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite is bound to a different email")

        email = payload.email.lower().strip()
        if self.user_repo.get_by_email(email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

        is_dup, matches = self.check_duplicate(payload.name, email, payload.phone, payload.dateOfBirth)

        user = self.user_repo.create(
            name=payload.name,
            email=email,
            password_hash=hash_password(payload.password),
            phone=payload.phone,
            role=RoleEnum.STUDENT.value,
        )

        profile = self.reg_repo.create_profile(
            user_id=user.id,
            date_of_birth=payload.dateOfBirth,
            gender=payload.gender,
            address=payload.address,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode,
            highest_qualification=payload.highestQualification,
            institution_name=payload.institutionName,
            graduation_year=payload.graduationYear,
            percentage_or_cgpa=payload.percentageOrCgpa,
            stream=payload.stream,
            course_id=invite.course_id,
            batch_id=invite.batch_id,
            registration_source=RegistrationSourceEnum.SELF_INVITE.value,
            photo_consent_given=payload.photoConsentGiven,
            photo_consent_at=datetime.now(timezone.utc) if payload.photoConsentGiven else None,
            duplicate_check_hash=_dup_hash(payload.name, email, payload.phone, payload.dateOfBirth),
        )

        # The invite always carries a validated batch (enforced at invite
        # creation), so the self-registered student is enrolled the same way a
        # staff-registered one is.
        if invite.batch_id:
            self._enrol_in_batch(user.id, invite.batch_id)

        self.reg_repo.update_invite(invite, status=InviteStatusEnum.USED.value, used_by=user.id)
        send_welcome_email(email, payload.name)
        return user, profile, is_dup, matches

    # ---------- Document / photo upload ----------
    def upload_document(self, user_id: uuid.UUID, uploader_id: uuid.UUID, document_type: str, file_bytes: bytes, filename: str, consent: bool = False):
        profile = self.reg_repo.get_profile_by_user_id(user_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

        if document_type == DocumentTypeEnum.PHOTO.value and not (consent or profile.photo_consent_given):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Consent is required before capturing/storing a photo",
            )

        url = upload_file_to_blob(file_bytes, filename, folder=f"students/{user_id}/{document_type}")
        doc = self.reg_repo.add_document(
            student_profile_id=profile.id,
            document_type=document_type,
            file_url=url,
            file_name=filename,
            uploaded_by=uploader_id,
        )

        if document_type == DocumentTypeEnum.PHOTO.value and consent and not profile.photo_consent_given:
            profile.photo_consent_given = True
            profile.photo_consent_at = datetime.now(timezone.utc)
            self.db.commit()

        return doc

    # ---------- Bulk registration via spreadsheet ----------
    def bulk_register(self, uploader_id: uuid.UUID, file_bytes: bytes, filename: str):
        import pandas as pd

        try:
            if filename.lower().endswith(".csv"):
                df = pd.read_csv(io.BytesIO(file_bytes))
            else:
                df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not parse spreadsheet: {e}")

        # course_id and batch_id are mandatory here for the same reason they
        # are on the single-student form: an unbatched student is invisible to
        # every batch-scoped feature.
        required_cols = {"name", "email", "course_id", "batch_id"}
        missing = required_cols - set(c.strip().lower() for c in df.columns)
        if missing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing required columns: {missing}")

        df.columns = [c.strip().lower() for c in df.columns]

        file_url = upload_file_to_blob(file_bytes, filename, folder="bulk_uploads")
        job = self.reg_repo.create_bulk_job(
            file_name=filename,
            file_url=file_url,
            status=BulkJobStatusEnum.PROCESSING.value,
            total_rows=len(df),
            uploaded_by=uploader_id,
        )

        success_count = 0
        errors: list[str] = []

        for idx, row in df.iterrows():
            try:
                name = str(row.get("name", "")).strip()
                email = str(row.get("email", "")).strip().lower()
                if not name or not email or email == "nan":
                    raise ValueError("name and email are required")

                if self.user_repo.get_by_email(email):
                    raise ValueError(f"email already registered: {email}")

                phone = str(row.get("phone", "")).strip() if pd.notna(row.get("phone", None)) else None
                course_id = str(row.get("course_id", "")).strip() if pd.notna(row.get("course_id", None)) else ""
                batch_id = str(row.get("batch_id", "")).strip() if pd.notna(row.get("batch_id", None)) else ""
                if not course_id or not batch_id:
                    raise ValueError("course_id and batch_id are required")

                # Resolved + validated per row so one bad row is reported
                # against that row instead of failing (or silently corrupting)
                # the whole job. Accepts course code/name and batch name, not
                # just UUIDs.
                course_uuid, batch_uuid = self._validate_course_and_batch(
                    course_id, batch_id, course_field="course_id", batch_field="batch_id"
                )

                temp_password = secrets.token_urlsafe(9)
                user = self.user_repo.create(
                    name=name,
                    email=email,
                    password_hash=hash_password(temp_password),
                    phone=phone,
                    role=RoleEnum.STUDENT.value,
                    must_change_password=True,
                    created_by=uploader_id,
                )
                self.reg_repo.create_profile(
                    user_id=user.id,
                    course_id=course_uuid,
                    batch_id=batch_uuid,
                    registration_source=RegistrationSourceEnum.BULK_UPLOAD.value,
                    duplicate_check_hash=_dup_hash(name, email, phone, None),
                )
                self._enrol_in_batch(user.id, batch_uuid)
                send_welcome_email(email, name, temp_password=temp_password)
                success_count += 1
            except HTTPException as row_err:
                # _validate_course_and_batch raises HTTPException; surface its
                # message as a row error rather than aborting the whole upload.
                self.db.rollback()
                errors.append(f"Row {idx + 2}: {row_err.detail}")
            except Exception as row_err:  # noqa
                self.db.rollback()
                errors.append(f"Row {idx + 2}: {row_err}")

        job = self.reg_repo.update_bulk_job(
            job,
            status=BulkJobStatusEnum.COMPLETED.value,
            success_count=success_count,
            failed_count=len(errors),
            error_report="\n".join(errors) if errors else None,
        )
        return job, errors
