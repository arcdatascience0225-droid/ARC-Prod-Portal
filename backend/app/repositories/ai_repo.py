from sqlalchemy.orm import Session
from app.models.core import ChatHistory, AiUsage
from app.models.phase5_models import Resume, StudyPlan


class AIRepo:
    def __init__(self, db: Session):
        self.db = db

    def log_chat(self, user_id, message, response):
        rec = ChatHistory(user_id=user_id, message=message, response=response)
        self.db.add(rec)
        self.db.commit()
        return rec

    def log_usage(self, user_id, module, tokens_used, cost):
        rec = AiUsage(user_id=user_id, module=module, tokens_used=tokens_used, cost=cost)
        self.db.add(rec)
        self.db.commit()
        return rec

    def save_resume(self, user_id, content, ai_text):
        existing = self.db.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.version.desc()).first()
        version = (existing.version + 1) if existing else 1
        resume = Resume(user_id=user_id, content=content, ai_generated_text=ai_text, version=version)
        self.db.add(resume)
        self.db.commit()
        self.db.refresh(resume)
        return resume

    def latest_resume(self, user_id):
        return self.db.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.version.desc()).first()

    def save_study_plan(self, user_id, goal, plan_data):
        existing = self.db.query(StudyPlan).filter(StudyPlan.user_id == user_id).first()
        if existing:
            existing.goal = goal
            existing.plan_data = plan_data
            self.db.commit()
            self.db.refresh(existing)
            return existing
        plan = StudyPlan(user_id=user_id, goal=goal, plan_data=plan_data)
        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_chat_history(self, user_id, limit=20):
        return (
            self.db.query(ChatHistory)
            .filter(ChatHistory.user_id == user_id)
            .order_by(ChatHistory.created_at.desc())
            .limit(limit)
            .all()
        )
