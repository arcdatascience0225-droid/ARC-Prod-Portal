from uuid import UUID
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.announcement_repository import AnnouncementRepository, ChatRepository
from app.repositories.batch_repository import BatchRepository
from app.repositories.notification_repo import NotificationRepo
from app.schemas.announcement import (
    AnnouncementCreate, AnnouncementOut, ChatMessageCreate, ChatMessageOut,
)


class AnnouncementService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AnnouncementRepository(db)
        self.notif_repo = NotificationRepo(db)

    def _validate_batches(self, batch_ids: List[UUID]) -> List[UUID]:
        if not batch_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one batch must be selected to broadcast to",
            )
        existing = set(self.repo.existing_batch_ids(batch_ids))
        missing = [str(b) for b in batch_ids if b not in existing]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown batch id(s): {', '.join(missing)}",
            )
        return list(existing)

    def broadcast(self, payload: AnnouncementCreate, sender_id: UUID) -> AnnouncementOut:
        """Create the announcement AND actually deliver it.

        Previously this only wrote `announcements` + `announcement_batches`
        rows and returned - `students_for_batches()` was never called, so no
        student was ever notified. Delivery now goes through the SAME
        notifications/notification_recipients tables the Admin broadcast uses,
        which is what the student dashboard's "Recent Notifications" widget
        reads from.
        """
        batch_ids = self._validate_batches(payload.batchIds)

        ann = self.repo.create(
            faculty_id=sender_id, title=payload.title,
            message=payload.message, batch_ids=batch_ids,
        )

        # Recipients = enrolled students + the staff assigned to those batches.
        recipient_ids = set(self.repo.students_for_batches(batch_ids))
        recipient_ids.update(self.repo.faculty_for_batches(batch_ids))
        recipient_ids.discard(sender_id)  # don't notify the author

        notification = None
        if recipient_ids:
            notification = self.notif_repo.create_notification(
                title=payload.title,
                message=payload.message,
                type="announcement",
                channel=payload.channel,
                created_by=sender_id,
                target_roles=[],
                target_users=[str(u) for u in recipient_ids],
            )
            self.notif_repo.add_recipients(notification.id, list(recipient_ids))

            # Reuse the existing dispatch pipeline for email/sms fan-out.
            from app.services.notification_service import NotificationService
            NotificationService(self.db)._dispatch(notification, [str(u) for u in recipient_ids])

        return AnnouncementOut(
            id=ann.id, title=ann.title, message=ann.message,
            facultyId=ann.faculty_id, createdAt=ann.created_at,
            batchIds=batch_ids,
            recipientCount=len(recipient_ids),
            notificationId=notification.id if notification else None,
        )

    def list_my_announcements(self, faculty_id: UUID) -> List[AnnouncementOut]:
        out = []
        for a in self.repo.list_for_faculty(faculty_id):
            out.append(AnnouncementOut(
                id=a.id, title=a.title, message=a.message, facultyId=a.faculty_id,
                createdAt=a.created_at, batchIds=self.repo.batch_ids_for(a.id),
            ))
        return out

    def list_for_student(self, student_id: UUID) -> List[AnnouncementOut]:
        """Announcements aimed at any batch this student is enrolled in."""
        batch_ids = BatchRepository(self.db).batch_ids_for_student(student_id)
        out = []
        for a in self.repo.list_for_batches(batch_ids):
            out.append(AnnouncementOut(
                id=a.id, title=a.title, message=a.message, facultyId=a.faculty_id,
                createdAt=a.created_at, batchIds=self.repo.batch_ids_for(a.id),
            ))
        return out


class ChatService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ChatRepository(db)

    def _assert_student(self, student_id: UUID) -> User:
        user = self.db.query(User).filter(User.id == student_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        return user

    def send_message(self, faculty_id: UUID, payload: ChatMessageCreate) -> ChatMessageOut:
        """Faculty -> student. The thread is keyed on (faculty_id, student_id),
        so messages to different students no longer bleed into one another."""
        self._assert_student(payload.studentId)
        chat = self.repo.add_message(
            sender_id=faculty_id,
            faculty_id=faculty_id,
            student_id=payload.studentId,
            message=payload.message,
        )
        return self._to_out(chat)

    def send_message_as_student(self, student_id: UUID, faculty_id: UUID, message: str) -> ChatMessageOut:
        """Student -> faculty, into the same (faculty_id, student_id) thread."""
        chat = self.repo.add_message(
            sender_id=student_id,
            faculty_id=faculty_id,
            student_id=student_id,
            message=message,
        )
        return self._to_out(chat)

    def get_thread(self, faculty_id: UUID, student_id: UUID) -> List[ChatMessageOut]:
        return [self._to_out(c) for c in self.repo.history_with_student(faculty_id, student_id)]

    def _to_out(self, c) -> ChatMessageOut:
        return ChatMessageOut(
            id=c.id, userId=c.user_id, senderId=c.user_id,
            facultyId=c.faculty_id, studentId=c.student_id,
            sentByStudent=(c.user_id == c.student_id),
            message=c.message, response=c.response, createdAt=c.created_at,
        )
