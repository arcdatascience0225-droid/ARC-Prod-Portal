from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.assessment_repository import AssessmentRepository
from app.schemas.assessment import AssessmentCreate, AssessmentOut


class AssessmentService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AssessmentRepository(db)

    def create_assessment(self, payload: AssessmentCreate, created_by: UUID) -> AssessmentOut:
        assessment = self.repo.create(
            title=payload.title, description=payload.description, type_=payload.type,
            question_ids=payload.questionIds, duration=payload.duration, created_by=created_by,
            batch_ids=payload.batchIds,
            active_from=payload.activeFrom, active_until=payload.activeUntil,
            max_violations=payload.maxViolations,
        )
        return self._to_out(assessment)

    def list_my_assessments(self, created_by: UUID) -> list[AssessmentOut]:
        return [self._to_out(a) for a in self.repo.list_by_creator(created_by)]

    def list_all_assessments(self) -> list[AssessmentOut]:
        """Admin/Super Admin view — every assessment across all faculty,
        not scoped to a single creator like list_my_assessments()."""
        return [self._to_out(a) for a in self.repo.list_all()]

    def _to_out(self, a) -> AssessmentOut:
        qids = a.question_ids if isinstance(a.question_ids, list) else []
        bids = a.batch_ids if isinstance(a.batch_ids, list) else []
        return AssessmentOut(
            id=a.id, title=a.title, description=a.description, type=a.type,
            isActive=bool(getattr(a, 'is_active', True)),
            activeFrom=getattr(a, 'active_from', None),
            activeUntil=getattr(a, 'active_until', None),
            questionIds=[UUID(q) if isinstance(q, str) else q for q in qids],
            batchIds=[UUID(b) if isinstance(b, str) else b for b in bids] or None,
            duration=a.duration, createdBy=a.created_by, createdAt=a.created_at,
            questionCount=len(qids), maxViolations=getattr(a, "max_violations", None) or 10,
        )
