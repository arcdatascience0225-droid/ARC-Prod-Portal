from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles, CurrentUser
from app.schemas.placement import (
    JobOut,
    ApplicationCreate,
    ApplicationOut,
    OfferOut,
)
from app.services.placement_service import MatchingService, ApplicationService, OfferService
from app.repositories.placement_repository import OfferRepository

router = APIRouter(prefix="/api/v1/student/jobs", tags=["Student Jobs & Placement"])


def _job_to_out(job) -> JobOut:
    return JobOut(
        id=job.id,
        company_id=job.company_id,
        company_name=job.company.name if job.company else None,
        title=job.title,
        description=job.description,
        required_skills=job.required_skills or [],
        min_experience_years=job.min_experience_years,
        min_score_percent=job.min_score_percent,
        job_type=job.job_type,
        location=job.location,
        salary_min=float(job.salary_min) if job.salary_min else None,
        salary_max=float(job.salary_max) if job.salary_max else None,
        openings=job.openings,
        status=job.status,
        application_deadline=job.application_deadline,
        posted_by=job.posted_by,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _application_to_out(app) -> ApplicationOut:
    return ApplicationOut(
        id=app.id,
        job_id=app.job_id,
        job_title=app.job.title if app.job else None,
        company_name=app.job.company.name if app.job and app.job.company else None,
        student_id=app.student_id,
        student_name=None,
        match_score=app.match_score,
        match_reasoning=app.match_reasoning,
        status=app.status,
        applied_at=app.applied_at,
        updated_at=app.updated_at,
    )


@router.get("/recommended")
def recommended_jobs(
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(["student"])),
):
    """STU-JB-001: AI-recommended jobs ranked by Gemini match score for this student."""
    scored = MatchingService(db).recommend_jobs_for_student(user.id, limit)
    return [
        {
            **_job_to_out(item["job"]).model_dump(by_alias=True),
            "matchScore": item["matchScore"],
            "matchReasoning": item["reasoning"],
            "skillsMatched": item.get("skillsMatched", []),
            "skillsMissing": item.get("skillsMissing", []),
        }
        for item in scored
    ]


@router.post("/{job_id}/apply", response_model=ApplicationOut, status_code=201)
def apply_to_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(["student"])),
):
    """STU-JB-002: Apply to a job posting."""
    app = ApplicationService(db).apply_to_job(job_id, user.id)
    return _application_to_out(app)


@router.get("/applications", response_model=List[ApplicationOut])
def my_applications(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(["student"])),
):
    """STU-JB-003 / STU-PL-001: Application status tracker + companies applied."""
    apps = ApplicationService(db).list_student_applications(user.id)
    return [_application_to_out(a) for a in apps]


@router.post("/applications/{application_id}/withdraw", response_model=ApplicationOut)
def withdraw_application(
    application_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(["student"])),
):
    app = ApplicationService(db).withdraw(application_id, user.id)
    return _application_to_out(app)


@router.get("/offers", response_model=List[OfferOut])
def my_offers(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(["student"])),
):
    """STU-PL-003: View offer details (salary, location, joining date)."""
    apps = ApplicationService(db).list_student_applications(user.id)
    offer_repo = OfferRepository(db)
    offers = []
    for app in apps:
        offer = offer_repo.get_by_application(app.id)
        if offer:
            offers.append(offer)
    return offers


@router.post("/offers/{offer_id}/respond", response_model=OfferOut)
def respond_to_offer(
    offer_id: UUID,
    status: str = Query(..., pattern="^(accepted|declined)$"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(["student"])),
):
    """STU-PL-003: Accept/decline offer -> updates application to placed/rejected."""
    return OfferService(db).respond_to_offer(offer_id, user.id, status)
