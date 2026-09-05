from uuid import UUID
from typing import List, Optional

from sqlalchemy.orm import Session

from app.repositories.question_repository import QuestionRepository
from app.schemas.question_bank import QuestionCreate, QuestionUpdate, QuestionOut


class QuestionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = QuestionRepository(db)

    def create_question(self, payload: QuestionCreate, created_by: UUID) -> QuestionOut:
        q = self.repo.create(
            question_text=payload.questionText, type_=payload.type, marks=payload.marks,
            created_by=created_by, tags=payload.tags, data=payload.data,
        )
        if payload.type == "coding":
            self.repo.attach_coding_details(
                question_id=q.id, starter_code=payload.starterCode,
                language=payload.language or "python", test_cases=payload.testCases,
            )
        return self._to_out(q)

    def update_question(self, question_id: UUID, payload: QuestionUpdate) -> Optional[QuestionOut]:
        q = self.repo.update(
            question_id, question_text=payload.questionText,
            marks=payload.marks, tags=payload.tags, data=payload.data,
        )
        return self._to_out(q) if q else None

    def delete_question(self, question_id: UUID) -> bool:
        return self.repo.delete(question_id)

    def list_bank(self, type_: Optional[str] = None, tag: Optional[str] = None) -> List[QuestionOut]:
        return [self._to_out(q) for q in self.repo.list_bank(type_, tag)]

    def _to_out(self, q) -> QuestionOut:
        return QuestionOut(
            id=q.id, questionText=q.question_text, type=q.type, marks=q.marks,
            tags=q.tags, data=q.data, createdBy=q.created_by, createdAt=q.created_at,
        )
