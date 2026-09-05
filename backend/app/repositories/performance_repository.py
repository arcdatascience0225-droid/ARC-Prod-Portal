from uuid import UUID
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.shared_refs import Result, User
from app.models.batch import BatchStudent
from app.models.assignment_feedback import AssignmentFeedback


class PerformanceRepository:
    def __init__(self, db: Session):
        self.db = db

    def batch_student_ids(self, batch_id: UUID) -> List[UUID]:
        rows = self.db.query(BatchStudent.user_id).filter(BatchStudent.batch_id == batch_id).all()
        return [r[0] for r in rows]

    def results_for_students(self, student_ids: List[UUID]) -> List[Result]:
        if not student_ids:
            return []
        return self.db.query(Result).filter(
            Result.user_id.in_(student_ids), Result.status == "completed"
        ).all()

    def student_name(self, student_id: UUID) -> str:
        user = self.db.query(User).filter(User.id == student_id).first()
        return user.name if user else "Unknown"

    def create_feedback(self, result_id: UUID, faculty_id: UUID, feedback_text: str,
                         score_override: float | None) -> AssignmentFeedback:
        fb = AssignmentFeedback(
            result_id=result_id, faculty_id=faculty_id,
            feedback_text=feedback_text, score_override=score_override,
        )
        self.db.add(fb)
        self.db.commit()
        self.db.refresh(fb)

        if score_override is not None:
            result = self.db.query(Result).filter(Result.id == result_id).first()
            if result:
                result.score = score_override
                self.db.commit()
        return fb
