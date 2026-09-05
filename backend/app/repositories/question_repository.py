from uuid import UUID
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.shared_refs import Question, CodingQuestion, TestCase
from app.models.assessment import StudentAnswer, CodingSubmission


class QuestionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, question_text: str, type_: str, marks: int, created_by: UUID,
               tags: Optional[List[str]] = None, data: Optional[dict] = None) -> Question:
        q = Question(
            question_text=question_text, type=type_, marks=marks,
            created_by=created_by, tags=tags, data=data,
            is_bank_item=True, assessment_id=None,
        )
        self.db.add(q)
        self.db.commit()
        self.db.refresh(q)
        return q

    def attach_coding_details(self, question_id: UUID, starter_code: Optional[str],
                              language: str, test_cases: Optional[List[dict]]) -> None:
        cq = CodingQuestion(question_id=question_id, starter_code=starter_code, language=language)
        self.db.add(cq)
        self.db.commit()
        self.db.refresh(cq)
        for tc in (test_cases or []):
            self.db.add(TestCase(
                coding_question_id=cq.id,
                input=tc.get("input"),
                expected_output=tc.get("expectedOutput"),
                is_hidden=tc.get("isHidden", False),
            ))
        self.db.commit()

    def get(self, question_id: UUID) -> Optional[Question]:
        return self.db.query(Question).filter(Question.id == question_id).first()

    def update(self, question_id: UUID, **fields) -> Optional[Question]:
        q = self.get(question_id)
        if not q:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(q, k, v)
        self.db.commit()
        self.db.refresh(q)
        return q

    def delete(self, question_id: UUID) -> bool:
        q = self.get(question_id)
        if not q:
            return False

        coding_ids = [
            cq.id for cq in self.db.query(CodingQuestion.id)
            .filter(CodingQuestion.question_id == question_id).all()
        ]
        if coding_ids:
            self.db.query(TestCase).filter(TestCase.coding_question_id.in_(coding_ids)) \
                .delete(synchronize_session=False)
            self.db.query(CodingSubmission).filter(CodingSubmission.coding_question_id.in_(coding_ids)) \
                .delete(synchronize_session=False)
            self.db.query(CodingQuestion).filter(CodingQuestion.id.in_(coding_ids)) \
                .delete(synchronize_session=False)

        self.db.query(StudentAnswer).filter(StudentAnswer.question_id == question_id) \
            .delete(synchronize_session=False)

        self.db.delete(q)
        self.db.commit()
        return True

    def list_bank(self, type_: Optional[str] = None, tag: Optional[str] = None) -> List[Question]:
        query = self.db.query(Question).filter(Question.is_bank_item.is_(True))
        if type_:
            query = query.filter(Question.type == type_)
        if tag:
            query = query.filter(Question.tags.any(tag))
        return query.order_by(Question.created_at.desc()).all()
