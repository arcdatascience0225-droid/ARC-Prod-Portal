import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, STAFF_ROLES, ADMIN_ROLES
from app.models.user import User
from app.models.enums import RoleEnum
from app.services.registration_service import RegistrationService
from app.schemas.registration import (
    StudentRegisterByStaffRequest,
    StudentSelfRegisterRequest,
    CreateInviteRequest,
    InviteOut,
    StudentProfileOut,
    DuplicateCheckResult,
    BulkUploadResult,
    CourseOut,
    BatchOut,
)

router = APIRouter(prefix="/api/v1/registration", tags=["Registration"])


def _profile_out(user, profile, is_dup=False) -> StudentProfileOut:
    return StudentProfileOut(
        id=str(profile.id),
        userId=str(user.id),
        name=user.name,
        email=user.email,
        phone=user.phone,
        dateOfBirth=profile.date_of_birth,
        gender=profile.gender,
        courseId=str(profile.course_id) if profile.course_id else None,
        batchId=str(profile.batch_id) if profile.batch_id else None,
        registrationSource=profile.registration_source,
        photoConsentGiven=profile.photo_consent_given,
        isDuplicateSuspect=is_dup,
    )


@router.post("/students/staff", response_model=StudentProfileOut, status_code=201)  # REG-001
def register_student_by_staff(
    payload: StudentRegisterByStaffRequest,
    current_user: User = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    user, profile, is_dup, _ = RegistrationService(db).register_by_staff(payload, current_user.id)
    return _profile_out(user, profile, is_dup)


@router.post("/invites", response_model=InviteOut, status_code=201)  # REG-002
def create_invite(
    payload: CreateInviteRequest,
    current_user: User = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    invite, link = RegistrationService(db).create_invite(
        current_user.id, payload.email, payload.courseId, payload.batchId, payload.expiresInHours
    )
    return InviteOut(token=invite.token, inviteLink=link, expiresAt=invite.expires_at)


@router.get("/invites/{token}/validate")  # REG-003
def validate_invite(token: str, db: Session = Depends(get_db)):
    invite = RegistrationService(db).validate_invite(token)
    return {
        "valid": True,
        "email": invite.email,
        "courseId": str(invite.course_id) if invite.course_id else None,
        "batchId": str(invite.batch_id) if invite.batch_id else None,
    }


@router.post("/students/self", response_model=StudentProfileOut, status_code=201)  # REG-004
def self_register_via_invite(payload: StudentSelfRegisterRequest, db: Session = Depends(get_db)):
    user, profile, is_dup, _ = RegistrationService(db).register_via_invite(payload)
    return _profile_out(user, profile, is_dup)


@router.post("/students/bulk-upload", response_model=BulkUploadResult, status_code=201)  # REG-005
async def bulk_register_students(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    file_bytes = await file.read()
    job, errors = RegistrationService(db).bulk_register(current_user.id, file_bytes, file.filename)
    return BulkUploadResult(
        jobId=str(job.id),
        totalRows=job.total_rows,
        successCount=job.success_count,
        failedCount=job.failed_count,
        errors=errors[:50],  # cap response payload size
    )


@router.post("/students/{user_id}/documents", status_code=201)  # REG-006, REG-007, REG-008 (photo consent)
async def upload_student_document(
    user_id: uuid.UUID,
    document_type: str = Form(...),
    consent: bool = Form(False),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Students can upload their own docs; staff can upload on behalf of a student
    if current_user.role == RoleEnum.STUDENT.value and current_user.id != user_id:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Cannot upload documents for another user")

    file_bytes = await file.read()
    doc = RegistrationService(db).upload_document(
        user_id, current_user.id, document_type, file_bytes, file.filename, consent
    )
    return {"id": str(doc.id), "fileUrl": doc.file_url, "documentType": doc.document_type}


@router.get("/duplicate-check", response_model=DuplicateCheckResult)  # REG-011
def duplicate_check(
    name: str = Query(...),
    email: str = Query(...),
    phone: str | None = Query(None),
    current_user: User = Depends(require_roles(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    is_dup, matches = RegistrationService(db).check_duplicate(name, email, phone)
    return DuplicateCheckResult(isDuplicate=is_dup, matchedUserIds=matches)


@router.get("/courses", response_model=list[CourseOut])  # REG-012
def list_courses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    courses = RegistrationService(db).reg_repo.list_courses()
    return [CourseOut(id=str(c.id), name=c.name, code=c.code) for c in courses]


@router.post("/courses", response_model=CourseOut, status_code=201)  # REG-013
def create_course(
    name: str = Form(...),
    code: str = Form(...),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    course = RegistrationService(db).reg_repo.create_course(name=name, code=code)
    return CourseOut(id=str(course.id), name=course.name, code=course.code)


@router.get("/batches", response_model=list[BatchOut])  # REG-014
def list_batches(course_id: str | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course_uuid = None
    if course_id:
        # Unguarded uuid.UUID() on a raw query param returned a 500 on any
        # malformed value; a bad filter is client error, not server error.
        try:
            course_uuid = uuid.UUID(course_id)
        except ValueError:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="course_id must be a valid UUID")
    batches = RegistrationService(db).reg_repo.list_batches(course_uuid)
    return [BatchOut(id=str(b.id), name=b.name, courseId=str(b.course_id)) for b in batches]


@router.post("/batches", response_model=BatchOut, status_code=201)  # REG-015
def create_batch(
    name: str = Form(...),
    course_id: str = Form(...),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    from fastapi import HTTPException, status as http_status
    try:
        course_uuid = uuid.UUID(course_id)
    except ValueError:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="course_id must be a valid UUID")
    svc = RegistrationService(db)
    if not svc.reg_repo.get_course(course_uuid):
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST,
                            detail=f"Course {course_id} does not exist")
    batch = svc.reg_repo.create_batch(name=name, course_id=course_uuid)
    return BatchOut(id=str(batch.id), name=batch.name, courseId=str(batch.course_id))
