from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import faculty_or_trainer, CurrentUser
from app.db.session import get_db
from app.schemas.batch import BatchCreate, BatchOut, StudentInBatch, AddStudentsToBatch
from app.services.batch_service import BatchService

router = APIRouter(prefix="/faculty", tags=["Faculty Dashboard"])


@router.post("/batches", response_model=BatchOut, summary="Create a new batch (FAC-001)")
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    if payload.facultyId is None:
        payload.facultyId = current_user.id
    return BatchService(db).create_batch(payload)


@router.get("/batches", response_model=List[BatchOut], summary="List batches assigned to me (FAC-001)")
def my_batches(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    is_admin = current_user.role in ("admin", "super_admin")
    return BatchService(db).list_my_batches(current_user.id, is_admin=is_admin)


@router.post("/batches/{batch_id}/students", summary="Add students to a batch (FAC-001)")
def add_students(
    batch_id: UUID,
    payload: AddStudentsToBatch,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    BatchService(db).add_students(batch_id, payload.studentIds)
    return {"message": "Students added to batch"}


@router.get("/batches/{batch_id}/students", response_model=List[StudentInBatch],
            summary="List students in a batch (FAC-001)")
def batch_students(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return BatchService(db).list_students(batch_id)


@router.get("/batches/{batch_id}/assignments-progress",
            summary="Every assignment, with completion count for this batch's students")
def batch_assignments_progress(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return BatchService(db).assignments_progress(batch_id)


@router.get("/faculty-directory", summary="Admin: every faculty with their assigned batches (and student counts)")
def faculty_directory(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return BatchService(db).faculty_directory()


@router.get("/my-summary", summary="My lectures/assessments/mocks activity summary")
def my_summary(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return BatchService(db).faculty_summary(current_user.id)


@router.get("/batches-summary", summary="Batches table: dates, delay, syllabus %, batch time, counts")
def batches_summary(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    is_admin = current_user.role in ("admin", "super_admin")
    return BatchService(db).batches_summary(current_user.id, is_admin=is_admin)


@router.get("/batches/{batch_id}/detail", summary="Single batch detail drill-down")
def batch_detail(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(faculty_or_trainer),
):
    return BatchService(db).batch_detail(batch_id)
