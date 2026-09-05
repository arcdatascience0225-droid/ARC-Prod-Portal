from uuid import UUID
from typing import List

from sqlalchemy.orm import Session

from app.models.announcement import Announcement, AnnouncementBatch
from app.models.batch import Batch, BatchStudent, BatchFaculty
from app.models.shared_refs import ChatHistory


class AnnouncementRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, faculty_id: UUID, title: str, message: str, batch_ids: List[UUID]) -> Announcement:
        ann = Announcement(faculty_id=faculty_id, title=title, message=message)
        self.db.add(ann)
        self.db.flush()  # obtain ann.id without ending the transaction
        for bid in batch_ids:
            self.db.add(AnnouncementBatch(announcement_id=ann.id, batch_id=bid))
        self.db.commit()
        self.db.refresh(ann)
        return ann

    def batch_ids_for(self, announcement_id: UUID) -> List[UUID]:
        rows = self.db.query(AnnouncementBatch.batch_id).filter(
            AnnouncementBatch.announcement_id == announcement_id
        ).all()
        return [r[0] for r in rows]

    def existing_batch_ids(self, batch_ids: List[UUID]) -> List[UUID]:
        """Which of the requested batch ids actually exist (validation helper)."""
        if not batch_ids:
            return []
        rows = self.db.query(Batch.id).filter(Batch.id.in_(batch_ids)).all()
        return [r[0] for r in rows]

    def students_for_batches(self, batch_ids: List[UUID]) -> List[UUID]:
        if not batch_ids:
            return []
        rows = self.db.query(BatchStudent.user_id).filter(
            BatchStudent.batch_id.in_(batch_ids)
        ).distinct().all()
        return [r[0] for r in rows]

    def faculty_for_batches(self, batch_ids: List[UUID]) -> List[UUID]:
        """Staff attached to these batches, from BOTH places a batch can carry
        staff: the denormalised Batch.faculty_id / Batch.trainer_id columns and
        the BatchFaculty join table."""
        if not batch_ids:
            return []
        ids: set = set()

        rows = self.db.query(Batch.faculty_id, Batch.trainer_id).filter(
            Batch.id.in_(batch_ids)
        ).all()
        for faculty_id, trainer_id in rows:
            if faculty_id:
                ids.add(faculty_id)
            if trainer_id:
                ids.add(trainer_id)

        join_rows = self.db.query(BatchFaculty.faculty_id).filter(
            BatchFaculty.batch_id.in_(batch_ids)
        ).distinct().all()
        for (fid,) in join_rows:
            if fid:
                ids.add(fid)

        return list(ids)

    def list_for_faculty(self, faculty_id: UUID) -> List[Announcement]:
        return self.db.query(Announcement).filter(
            Announcement.faculty_id == faculty_id
        ).order_by(Announcement.created_at.desc()).all()

    def list_for_batches(self, batch_ids: List[UUID]) -> List[Announcement]:
        """Announcements targeted at any of these batches (student-side read)."""
        if not batch_ids:
            return []
        return (
            self.db.query(Announcement)
            .join(AnnouncementBatch, AnnouncementBatch.announcement_id == Announcement.id)
            .filter(AnnouncementBatch.batch_id.in_(batch_ids))
            .distinct()
            .order_by(Announcement.created_at.desc())
            .all()
        )


class ChatRepository:
    def __init__(self, db: Session):
        self.db = db

    def add_message(self, sender_id: UUID, faculty_id: UUID, student_id: UUID,
                    message: str, response: str = None) -> ChatHistory:
        """Store one faculty<->student message. `sender_id` is whoever wrote it;
        (faculty_id, student_id) identifies the thread it belongs to. Both
        thread columns are mandatory here - rows with them NULL belong to the
        AI-assistant conversation and must never surface in a person-to-person
        thread."""
        chat = ChatHistory(
            user_id=sender_id,
            faculty_id=faculty_id,
            student_id=student_id,
            message=message,
            response=response,
        )
        self.db.add(chat)
        self.db.commit()
        self.db.refresh(chat)
        return chat

    def history_with_student(self, faculty_id: UUID, student_id: UUID) -> List[ChatHistory]:
        """Only this exact (faculty, student) thread. Filtering on the pair -
        rather than `user_id IN (faculty, student)` - is what keeps different
        students' threads separate and keeps each party's private AI-assistant
        history out of the conversation."""
        return (
            self.db.query(ChatHistory)
            .filter(
                ChatHistory.faculty_id == faculty_id,
                ChatHistory.student_id == student_id,
            )
            .order_by(ChatHistory.created_at.asc())
            .all()
        )

    def faculty_ids_for_student(self, student_id: UUID) -> List[UUID]:
        """Faculty this student already has a thread with."""
        rows = (
            self.db.query(ChatHistory.faculty_id)
            .filter(ChatHistory.student_id == student_id, ChatHistory.faculty_id.isnot(None))
            .distinct()
            .all()
        )
        return [r[0] for r in rows]
