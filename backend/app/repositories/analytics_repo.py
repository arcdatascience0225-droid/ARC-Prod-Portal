from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.user import User
from app.models.core import Result, CodingSubmission, AiUsage  # shared tables from Phase 1-4
from app.models.phase5_models import Batch, BatchStudent, Course, CareerReadinessScore
from app.models.placement import Application, Job, Company


class AnalyticsRepo:
    def __init__(self, db: Session):
        self.db = db

    def student_results(self, user_id):
        return self.db.query(Result).filter(Result.user_id == user_id).all()

    def student_coding_submissions(self, user_id):
        return self.db.query(CodingSubmission).filter(CodingSubmission.user_id == user_id).all()

    def latest_career_score(self, user_id):
        return (
            self.db.query(CareerReadinessScore)
            .filter(CareerReadinessScore.user_id == user_id)
            .order_by(CareerReadinessScore.computed_at.desc())
            .first()
        )

    def save_career_score(self, user_id, score, breakdown):
        rec = CareerReadinessScore(user_id=user_id, score=score, breakdown=breakdown)
        self.db.add(rec)
        self.db.commit()
        self.db.refresh(rec)
        return rec

    def batch_students(self, batch_id):
        return self.db.query(BatchStudent).filter(BatchStudent.batch_id == batch_id).all()

    def all_batches(self):
        return self.db.query(Batch).all()

    def all_courses(self):
        return self.db.query(Course).all()

    def results_for_users(self, user_ids: list):
        if not user_ids:
            return []
        return self.db.query(Result).filter(Result.user_id.in_(user_ids)).all()

    def faculty_batches(self, faculty_id):
        return self.db.query(Batch).filter(Batch.faculty_id == faculty_id).all()

    def ai_usage_summary(self):
        rows = (
            self.db.query(
                AiUsage.module,
                func.sum(AiUsage.tokens_used).label("tokens"),
                func.sum(AiUsage.cost).label("cost"),
                func.count(AiUsage.id).label("count"),
            )
            .group_by(AiUsage.module)
            .all()
        )
        return rows

    def all_users_by_role(self, role):
        return self.db.query(User).filter(User.role == role).all()

    def placement_stats(self):
        total = self.db.query(func.count(func.distinct(Application.student_id))).scalar() or 0
        placed = (
            self.db.query(func.count(func.distinct(Application.student_id)))
            .filter(Application.status == "placed")
            .scalar()
            or 0
        )
        offers = self.db.query(func.count(Application.id)).filter(Application.status.in_(["offer", "placed"])).scalar() or 0
        top_companies = (
            self.db.query(Company.name, func.count(Application.id).label("hires"))
            .join(Job, Job.id == Application.job_id)
            .join(Company, Company.id == Job.company_id)
            .filter(Application.status == "placed")
            .group_by(Company.name)
            .order_by(func.count(Application.id).desc())
            .limit(5)
            .all()
        )
        return {"total": total, "placed": placed, "offers": offers, "top_companies": top_companies}
