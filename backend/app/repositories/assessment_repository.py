from uuid import UUID
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.shared_refs import Assessment, Question
from app.models.batch import BatchStudent


class AssessmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, title: str, description: Optional[str], type_: str,
               question_ids: List[UUID], duration: int, created_by: UUID,
               batch_ids: Optional[List[UUID]] = None,
               active_from=None, active_until=None, max_violations: int = 10) -> Assessment:
        assessment = Assessment(
            title=title, description=description, type=type_,
            question_ids=[str(q) for q in question_ids], duration=duration,
            created_by=created_by,
            batch_ids=[str(b) for b in batch_ids] if batch_ids else [],
            active_from=active_from, active_until=active_until,
            max_violations=max_violations,
        )
        self.db.add(assessment)
        self.db.commit()
        self.db.refresh(assessment)

        # mark linked bank questions as used in this assessment
        self.db.query(Question).filter(Question.id.in_(question_ids)).update(
            {"assessment_id": assessment.id}, synchronize_session=False
        )
        self.db.commit()
        return assessment

    def get(self, assessment_id: UUID) -> Optional[Assessment]:
        return self.db.query(Assessment).filter(Assessment.id == assessment_id).first()

    def list_by_creator(self, created_by: UUID) -> List[Assessment]:
        return self.db.query(Assessment).filter(Assessment.created_by == created_by).all()
    def list_all(self) -> List[Assessment]:
        return self.db.query(Assessment).order_by(Assessment.id.desc()).all()
    def list_for_student(self, batch_ids: list) -> list:
        all_assessments = self.db.query(Assessment).all()
        results = []
        batch_strs = [str(b) for b in batch_ids]
        for a in all_assessments:
            a_batches = a.batch_ids if isinstance(a.batch_ids, list) else []
            a_batch_strs = [str(b) for b in a_batches]
            # no batch restriction = visible to all
            if not a_batch_strs or any(b in a_batch_strs for b in batch_strs):
                results.append(a)
        return results

