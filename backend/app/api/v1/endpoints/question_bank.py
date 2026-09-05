from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import faculty_or_trainer, CurrentUser
from app.db.session import get_db
from app.schemas.question_bank import (
    QuestionCreate, QuestionUpdate, QuestionOut,
    AIQuestionGenerateRequest, AIQuestionGenerateResponse,
)
from app.services.question_service import QuestionService
from app.services.ai_question_gen_service import AIQuestionGenService
from app.services.gemini_client import GeminiNotConfiguredError

router = APIRouter(prefix="/question-bank", tags=["Question Bank"])


@router.post("", response_model=QuestionOut, summary="Add a question to the bank (FAC-003, FAC-004)")
def create_question(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return QuestionService(db).create_question(payload, created_by=current_user.id)


@router.get("", response_model=List[QuestionOut], summary="List/filter question bank (FAC-004)")
def list_questions(
    type: Optional[str] = None,
    tag: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return QuestionService(db).list_bank(type_=type, tag=tag)


@router.put("/{question_id}", response_model=QuestionOut, summary="Edit a bank question (FAC-004)")
def update_question(
    question_id: UUID,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    updated = QuestionService(db).update_question(question_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Question not found")
    return updated


@router.delete("/{question_id}", summary="Delete a bank question (FAC-004)")
def delete_question(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    deleted = QuestionService(db).delete_question(question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"message": "Question deleted"}


@router.post("/ai-generate", response_model=AIQuestionGenerateResponse,
             summary="Auto-generate questions using Gemini (FAC-003)")
def ai_generate_questions(
    payload: AIQuestionGenerateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    try:
        return AIQuestionGenService(db).generate(payload, requested_by=current_user.id)
    except GeminiNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e))
