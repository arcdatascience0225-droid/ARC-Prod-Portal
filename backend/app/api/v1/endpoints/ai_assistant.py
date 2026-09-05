from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_user
from app.services.ai_assistant_service import AIAssistantService
from app.schemas import ai_assistant as schemas

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=schemas.ChatResponse)
def chat(payload: schemas.ChatRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    response, tokens = AIAssistantService(db).chat(current_user.id, payload.message, payload.sessionContext)
    return schemas.ChatResponse(response=response, tokensUsed=tokens)


@router.post("/resume/generate")
def generate_resume(payload: schemas.ResumeGenerateRequest, db: Session = Depends(get_db),
                     current_user=Depends(get_current_user)):
    resume = AIAssistantService(db).generate_resume(current_user.id, payload.profile, payload.achievements, payload.targetRole)
    return {"id": resume.id, "content": resume.content, "aiGeneratedText": resume.ai_generated_text, "version": resume.version}


@router.post("/resume/improve")
def improve_resume(payload: schemas.ResumeImproveRequest, db: Session = Depends(get_db),
                    current_user=Depends(get_current_user)):
    text, tokens = AIAssistantService(db).improve_resume(current_user.id, payload.resumeText, payload.targetRole)
    return {"suggestions": text, "tokensUsed": tokens}


@router.post("/career-guidance")
def career_guidance(payload: schemas.CareerGuidanceRequest, db: Session = Depends(get_db),
                     current_user=Depends(get_current_user)):
    text, tokens = AIAssistantService(db).career_guidance(current_user.id, payload.question, payload.interestArea)
    return {"response": text, "tokensUsed": tokens}


@router.post("/study-plan")
def generate_study_plan(payload: schemas.StudyPlanRequest, db: Session = Depends(get_db),
                         current_user=Depends(get_current_user)):
    plan = AIAssistantService(db).generate_study_plan(current_user.id, payload.goal, payload.currentLevel, payload.hoursPerWeek)
    return {"id": plan.id, "goal": plan.goal, "planData": plan.plan_data}


@router.get("/strength-weakness", response_model=schemas.StrengthWeaknessOut)
def strength_weakness(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return AIAssistantService(db).strength_weakness_analysis(current_user.id)
