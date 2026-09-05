from datetime import datetime
from typing import Optional, List, Literal, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

QuestionType = Literal["mcq", "coding", "sql", "descriptive"]


class QuestionCreate(BaseModel):
    questionText: str
    type: QuestionType
    marks: int = 1
    tags: Optional[List[str]] = None
    # For MCQ: {"options": ["A","B","C","D"], "correctOption": "A"}
    # For SQL: {"schema": "...", "expectedQuery": "..."}
    # For Descriptive: {"guidelines": "..."}
    data: Optional[dict] = None
    # For coding type only:
    starterCode: Optional[str] = None
    language: Optional[str] = None
    testCases: Optional[List[dict]] = None  # [{"input":..,"expectedOutput":..,"isHidden":bool}]


class QuestionUpdate(BaseModel):
    questionText: Optional[str] = None
    marks: Optional[int] = None
    tags: Optional[List[str]] = None
    data: Optional[dict] = None


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: Optional[UUID] = None
    questionText: str
    type: str
    marks: int
    tags: Optional[List[str]] = None
    data: Optional[Any] = None
    createdBy: Optional[UUID] = None
    createdAt: Optional[datetime] = None


class AIQuestionGenerateRequest(BaseModel):
    topic: str
    type: QuestionType
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    count: int = 5
    saveToBank: bool = True


class AIQuestionGenerateResponse(BaseModel):
    generated: List[QuestionOut]
    tokensUsed: Optional[int] = None
    skippedCount: int = 0
