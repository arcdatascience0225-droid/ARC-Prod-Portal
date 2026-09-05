from sqlalchemy.orm import Session
from app.repositories.ai_repo import AIRepo
from app.services.ai_provider import get_ai_client, estimate_cost
from app.services.analytics_service import AnalyticsService

CHATBOT_SYSTEM = (
    "You are a helpful 24/7 assistant for students on an AI learning, assessment and "
    "placement platform. Answer clearly and concisely, and stay on topics related to "
    "courses, assessments, coding practice, career guidance and platform usage."
)

RESUME_SYSTEM = (
    "You are an expert resume writer. Produce clean, ATS-friendly, achievement-oriented "
    "resume content in plain text with clear section headers."
)

CAREER_SYSTEM = (
    "You are a career guidance counselor and interview coach for tech students. "
    "Give practical, encouraging, specific advice."
)


class AIAssistantService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AIRepo(db)
        self.ai = get_ai_client()
        self.analytics = AnalyticsService(db)

    def _log(self, user_id, module, tokens):
        self.repo.log_usage(user_id, module, tokens, estimate_cost(tokens))

    def chat(self, user_id, message, context=None):
        history_text = ""
        if context:
            history_text = "\n".join(f"{m.get('role','user')}: {m.get('content','')}" for m in context[-6:])
        prompt = f"{history_text}\nStudent: {message}\nAssistant:"
        response, tokens = self.ai.generate(prompt, CHATBOT_SYSTEM)
        self.repo.log_chat(user_id, message, response)
        self._log(user_id, "chatbot", tokens)
        return response, tokens

    def generate_resume(self, user_id, profile, achievements, target_role):
        prompt = (
            f"Build a professional resume from this profile: {profile}\n"
            f"Achievements: {achievements}\n"
            f"Target role: {target_role or 'General technical role'}\n"
            "Include: Summary, Skills, Experience, Projects, Education, Achievements sections."
        )
        text, tokens = self.ai.generate(prompt, RESUME_SYSTEM)
        self._log(user_id, "resume_builder", tokens)
        resume = self.repo.save_resume(user_id, {"profile": profile, "achievements": achievements, "targetRole": target_role}, text)
        return resume

    def improve_resume(self, user_id, resume_text, target_role):
        prompt = (
            f"Review this resume and give specific improvement suggestions "
            f"(bullet points, quantify impact, keyword optimization for '{target_role or 'tech roles'}'):\n\n{resume_text}"
        )
        text, tokens = self.ai.generate(prompt, RESUME_SYSTEM)
        self._log(user_id, "resume_improvement", tokens)
        return text, tokens

    def career_guidance(self, user_id, question, interest_area):
        prompt = f"Interest area: {interest_area or 'not specified'}\nQuestion: {question}"
        text, tokens = self.ai.generate(prompt, CAREER_SYSTEM)
        self._log(user_id, "career_guidance", tokens)
        return text, tokens

    def generate_study_plan(self, user_id, goal, current_level, hours_per_week):
        prompt = (
            f"Create a structured weekly study/roadmap plan as JSON with keys "
            f"'weeks' (list of {{'week': int, 'focus': str, 'tasks': [str]}}).\n"
            f"Goal: {goal}\nCurrent level: {current_level or 'beginner'}\n"
            f"Available hours/week: {hours_per_week}\nPlan for 8 weeks."
        )
        data, tokens = self.ai.generate_json(prompt, CAREER_SYSTEM)
        self._log(user_id, "study_plan", tokens)
        plan = self.repo.save_study_plan(user_id, goal, data)
        return plan

    def strength_weakness_analysis(self, user_id):
        analytics = self.analytics.student_analytics(user_id)
        career = self.analytics.compute_career_readiness(user_id)
        prompt = (
            f"Given this student performance data: {analytics}, write a short (3-4 sentence) "
            f"recommendation for what they should focus on next."
        )
        text, tokens = self.ai.generate(prompt, CAREER_SYSTEM)
        self._log(user_id, "strength_weakness", tokens)
        return {
            "strengths": analytics["strengths"],
            "weaknesses": analytics["weaknesses"],
            "recommendation": text,
            "careerReadinessScore": career["score"],
        }
