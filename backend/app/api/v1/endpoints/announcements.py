from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session

from app.core.deps import require_roles, STAFF_ROLES, get_current_user, CurrentUser
from app.db.session import get_db
from app.models.enums import RoleEnum
from app.repositories.batch_repository import BatchRepository
from app.schemas.announcement import (
    AnnouncementCreate, AnnouncementOut, ChatMessageCreate,
    StudentChatMessageCreate, ChatMessageOut,
)
from app.services.announcement_service import AnnouncementService, ChatService

router = APIRouter(tags=["Announcements & Chat"])

# Batch-based broadcasting is open to all staff (Faculty, Trainer, Admin,
# Super Admin, HR, Placement Coordinator) - previously faculty/trainer only,
# which forced Admin/HR to use the separate role-targeted
# /notifications/broadcast endpoint that had no batch targeting at all.
staff_only = require_roles(*STAFF_ROLES)


@router.post("/announcements", response_model=AnnouncementOut, status_code=201,
             summary="Broadcast an announcement to one or more batches (FAC-008)")
def broadcast_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(staff_only),
):
    """Delivers to every enrolled student in the targeted batches plus the
    staff assigned to those batches, via the shared notifications tables."""
    return AnnouncementService(db).broadcast(payload, sender_id=current_user.id)


@router.get("/announcements", response_model=List[AnnouncementOut],
            summary="List announcements I've sent (FAC-008)")
def my_announcements(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(staff_only),
):
    return AnnouncementService(db).list_my_announcements(current_user.id)


@router.get("/announcements/mine", response_model=List[AnnouncementOut],
            summary="Announcements addressed to my batches (student view)")
def announcements_for_me(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return AnnouncementService(db).list_for_student(current_user.id)


# ---------------------------- Faculty <-> Student chat ----------------------------

def _assert_faculty_owns_student(db: Session, faculty_id: UUID, student_id: UUID) -> None:
    """A faculty member may only message students who share a batch with them.
    Admins bypass this."""
    batch_repo = BatchRepository(db)
    faculty_batches = {b.id for b in batch_repo.list_for_faculty(faculty_id)}
    if not faculty_batches:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You have no batches assigned")
    student_batches = set(batch_repo.batch_ids_for_student(student_id))
    if not faculty_batches & student_batches:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="This student is not in any of your batches")


@router.post("/chat/students/{student_id}/messages", response_model=ChatMessageOut, status_code=201,
             summary="Send a chat message to a student (FAC-008)")
def send_message(
    student_id: UUID,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(staff_only),
):
    role = str(getattr(current_user.role, "value", current_user.role))
    if role not in (RoleEnum.ADMIN.value, RoleEnum.SUPER_ADMIN.value):
        _assert_faculty_owns_student(db, current_user.id, student_id)
    payload.studentId = student_id
    return ChatService(db).send_message(current_user.id, payload)


@router.get("/chat/students/{student_id}/messages", response_model=List[ChatMessageOut],
            summary="Get chat thread with a student (FAC-008)")
def get_thread(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(staff_only),
):
    return ChatService(db).get_thread(current_user.id, student_id)


@router.post("/chat/faculty/{faculty_id}/messages", response_model=ChatMessageOut, status_code=201,
             summary="Student replies to a faculty member in the same thread")
def student_send_message(
    faculty_id: UUID,
    payload: StudentChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(RoleEnum.STUDENT)),
):
    return ChatService(db).send_message_as_student(current_user.id, faculty_id, payload.message)


@router.get("/chat/faculty/{faculty_id}/messages", response_model=List[ChatMessageOut],
            summary="Student reads their thread with a faculty member")
def student_get_thread(
    faculty_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_roles(RoleEnum.STUDENT)),
):
    return ChatService(db).get_thread(faculty_id, current_user.id)
