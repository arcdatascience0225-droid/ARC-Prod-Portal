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

    @staticmethod
    def _encode(message: str, attachment_url: str | None, attachment_type: str | None) -> str:
        """Attachments piggyback on the existing `message` text column (no
        new DB column — this table already exists in production, and
        `create_tables.py` only creates missing tables, never adds columns
        to existing ones)."""
        if not attachment_url:
            return message
        return f"[ATTACHMENT|{attachment_type or 'file'}|{attachment_url}]{message}"

    @staticmethod
    def _decode(raw_message: str) -> tuple[str, str | None, str | None]:
        """Returns (clean_message, attachment_url, attachment_type)."""
        if raw_message.startswith("[ATTACHMENT|"):
            try:
                header, rest = raw_message.split("]", 1)
                _, atype, url = header.split("|", 2)
                return rest, url, atype
            except ValueError:
                pass
        return raw_message, None, None

    def send_message(self, faculty_id: UUID, payload: ChatMessageCreate) -> ChatMessageOut:
        """Faculty -> student. The thread is keyed on (faculty_id, student_id),
        so messages to different students no longer bleed into one another."""
        self._assert_student(payload.studentId)
        if not payload.message and not payload.attachmentUrl:
            raise HTTPException(status_code=400, detail="Message or attachment is required")
        chat = self.repo.add_message(
            sender_id=faculty_id,
            faculty_id=faculty_id,
            student_id=payload.studentId,
            message=self._encode(payload.message, payload.attachmentUrl, payload.attachmentType),
        )
        return self._to_out(chat)

    def send_message_as_student(self, student_id: UUID, faculty_id: UUID, message: str,
                                 attachment_url: str | None = None, attachment_type: str | None = None) -> ChatMessageOut:
        """Student -> faculty, into the same (faculty_id, student_id) thread."""
        if not message and not attachment_url:
            raise HTTPException(status_code=400, detail="Message or attachment is required")
        chat = self.repo.add_message(
            sender_id=student_id,
            faculty_id=faculty_id,
            student_id=student_id,
            message=self._encode(message, attachment_url, attachment_type),
        )
        return self._to_out(chat)

    def get_thread(self, faculty_id: UUID, student_id: UUID) -> List[ChatMessageOut]:
        return [self._to_out(c) for c in self.repo.history_with_student(faculty_id, student_id)]

    def _to_out(self, c) -> ChatMessageOut:
        clean_message, attachment_url, attachment_type = self._decode(c.message)
        return ChatMessageOut(
            id=c.id, userId=c.user_id, senderId=c.user_id,
            facultyId=c.faculty_id, studentId=c.student_id,
            sentByStudent=(c.user_id == c.student_id),
            message=clean_message, response=c.response,
            attachmentUrl=attachment_url, attachmentType=attachment_type,
            createdAt=c.created_at,
        )

    def list_conversations_for_faculty(self, faculty_id: UUID) -> list[dict]:
        """Every student across the faculty's batches, so they aren't stuck
        picking one student from a dropdown one at a time — mirrors a normal
        inbox with a conversation list."""
        from app.repositories.batch_repository import BatchRepository
        batch_repo = BatchRepository(self.db)
        batches = batch_repo.list_for_faculty(faculty_id)
        student_ids: set = set()
        for b in batches:
            for student_id in batch_repo.list_students(b.id):
                student_ids.add(student_id)

        out = []
        for student_id in student_ids:
            student = self.db.query(User).filter(User.id == student_id).first()
            if not student:
                continue
            last = self.repo.last_message(faculty_id, student_id)
            last_text, _, last_atype = self._decode(last.message) if last else ("", None, None)
            out.append({
                "studentId": str(student_id), "studentName": student.name, "studentEmail": student.email,
                "lastMessage": (last_text or ("📎 Attachment" if last_atype else "")) if last else None,
                "lastMessageAt": last.created_at if last else None,
            })
        out.sort(key=lambda c: c["lastMessageAt"] or "", reverse=True)
        return out

    def list_conversations_for_student(self, student_id: UUID) -> list[dict]:
        """Every faculty across the student's batches."""
        from app.repositories.batch_repository import BatchRepository
        batch_repo = BatchRepository(self.db)
        batch_ids = batch_repo.batch_ids_for_student(student_id)
        faculty_ids: set = set()
        for batch_id in batch_ids:
            batch = batch_repo.get(batch_id)
            if batch and batch.faculty_id:
                faculty_ids.add(batch.faculty_id)
            if batch and batch.trainer_id:
                faculty_ids.add(batch.trainer_id)

        out = []
        for faculty_id in faculty_ids:
            faculty = self.db.query(User).filter(User.id == faculty_id).first()
            if not faculty:
                continue
            last = self.repo.last_message(faculty_id, student_id)
            last_text, _, last_atype = self._decode(last.message) if last else ("", None, None)
            out.append({
                "facultyId": str(faculty_id), "facultyName": faculty.name, "facultyEmail": faculty.email,
                "lastMessage": (last_text or ("📎 Attachment" if last_atype else "")) if last else None,
                "lastMessageAt": last.created_at if last else None,
            })
        out.sort(key=lambda c: c["lastMessageAt"] or "", reverse=True)
        return out
