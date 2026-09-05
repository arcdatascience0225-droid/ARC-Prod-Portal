from typing import List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.placement import Company, Job, Application, Interview, Offer
from app.models.user import User  # shared User model from Phase 1 (auth)
from app.models.assessment import Result  # shared Result model from Phase 2 (assessments)


class CompanyRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, company: Company) -> Company:
        self.db.add(company)
        self.db.commit()
        self.db.refresh(company)
        return company

    def get(self, company_id: UUID) -> Optional[Company]:
        return self.db.query(Company).filter(Company.id == company_id).first()

    def list(self, skip: int = 0, limit: int = 50, search: Optional[str] = None) -> List[Company]:
        q = self.db.query(Company)
        if search:
            q = q.filter(Company.name.ilike(f"%{search}%"))
        return q.order_by(Company.created_at.desc()).offset(skip).limit(limit).all()

    def update(self, company: Company) -> Company:
        self.db.commit()
        self.db.refresh(company)
        return company

    def delete(self, company: Company) -> None:
        self.db.delete(company)
        self.db.commit()


class JobRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, job: Job) -> Job:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get(self, job_id: UUID) -> Optional[Job]:
        return self.db.query(Job).filter(Job.id == job_id).first()

    def list(
        self,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        company_id: Optional[UUID] = None,
    ) -> List[Job]:
        q = self.db.query(Job)
        if status:
            q = q.filter(Job.status == status)
        if company_id:
            q = q.filter(Job.company_id == company_id)
        return q.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()

    def update(self, job: Job) -> Job:
        self.db.commit()
        self.db.refresh(job)
        return job

    def delete(self, job: Job) -> None:
        self.db.delete(job)
        self.db.commit()


class ApplicationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, application: Application) -> Application:
        self.db.add(application)
        self.db.commit()
        self.db.refresh(application)
        return application

    def get(self, application_id: UUID) -> Optional[Application]:
        return self.db.query(Application).filter(Application.id == application_id).first()

    def get_by_job_and_student(self, job_id: UUID, student_id: UUID) -> Optional[Application]:
        return (
            self.db.query(Application)
            .filter(Application.job_id == job_id, Application.student_id == student_id)
            .first()
        )

    def list_by_student(self, student_id: UUID) -> List[Application]:
        return (
            self.db.query(Application)
            .filter(Application.student_id == student_id)
            .order_by(Application.applied_at.desc())
            .all()
        )

    def list_by_job(self, job_id: UUID, status: Optional[str] = None) -> List[Application]:
        q = self.db.query(Application).filter(Application.job_id == job_id)
        if status:
            q = q.filter(Application.status == status)
        return q.order_by(Application.match_score.desc().nullslast()).all()

    def list_all(self, skip: int = 0, limit: int = 100) -> List[Application]:
        return (
            self.db.query(Application)
            .order_by(Application.applied_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def update(self, application: Application) -> Application:
        self.db.commit()
        self.db.refresh(application)
        return application

    def count_all(self) -> int:
        return self.db.query(func.count(Application.id)).scalar() or 0

    def count_by_status(self, status: str) -> int:
        return (
            self.db.query(func.count(Application.id))
            .filter(Application.status == status)
            .scalar()
            or 0
        )


class InterviewRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, interview: Interview) -> Interview:
        self.db.add(interview)
        self.db.commit()
        self.db.refresh(interview)
        return interview

    def get(self, interview_id: UUID) -> Optional[Interview]:
        return self.db.query(Interview).filter(Interview.id == interview_id).first()

    def list_by_application(self, application_id: UUID) -> List[Interview]:
        return (
            self.db.query(Interview)
            .filter(Interview.application_id == application_id)
            .order_by(Interview.scheduled_at.asc())
            .all()
        )

    def list_by_interviewer(self, interviewer_id: UUID) -> List[Interview]:
        return (
            self.db.query(Interview)
            .filter(Interview.interviewer_id == interviewer_id)
            .order_by(Interview.scheduled_at.asc())
            .all()
        )

    def list_upcoming_for_student(self, student_id: UUID) -> List[Interview]:
        return (
            self.db.query(Interview)
            .join(Application, Interview.application_id == Application.id)
            .filter(Application.student_id == student_id)
            .order_by(Interview.scheduled_at.asc())
            .all()
        )

    def count_all(self) -> int:
        return self.db.query(func.count(Interview.id)).scalar() or 0

    def update(self, interview: Interview) -> Interview:
        self.db.commit()
        self.db.refresh(interview)
        return interview


class OfferRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, offer: Offer) -> Offer:
        self.db.add(offer)
        self.db.commit()
        self.db.refresh(offer)
        return offer

    def get(self, offer_id: UUID) -> Optional[Offer]:
        return self.db.query(Offer).filter(Offer.id == offer_id).first()

    def get_by_application(self, application_id: UUID) -> Optional[Offer]:
        return self.db.query(Offer).filter(Offer.application_id == application_id).first()

    def list_all(self) -> List[Offer]:
        return self.db.query(Offer).order_by(Offer.issued_at.desc()).all()

    def update(self, offer: Offer) -> Offer:
        self.db.commit()
        self.db.refresh(offer)
        return offer

    def avg_salary(self) -> Optional[float]:
        return self.db.query(func.avg(Offer.salary_offered)).filter(
            Offer.status == "accepted"
        ).scalar()

    def max_salary(self) -> Optional[float]:
        return self.db.query(func.max(Offer.salary_offered)).filter(
            Offer.status == "accepted"
        ).scalar()

    def count_all(self) -> int:
        return self.db.query(func.count(Offer.id)).scalar() or 0


class StudentProfileRepository:
    """Read-only helper to pull student + assessment data owned by other phases."""

    def __init__(self, db: Session):
        self.db = db

    def list_students(self) -> List[User]:
        return self.db.query(User).filter(User.role == "student").all()

    def get_student(self, student_id: UUID) -> Optional[User]:
        return self.db.query(User).filter(User.id == student_id, User.role == "student").first()

    def get_avg_score(self, student_id: UUID) -> Optional[float]:
        return (
            self.db.query(func.avg(Result.score))
            .filter(Result.user_id == student_id, Result.status == "completed")
            .scalar()
        )

    def get_results(self, student_id: UUID) -> List[Result]:
        return self.db.query(Result).filter(Result.user_id == student_id).all()
