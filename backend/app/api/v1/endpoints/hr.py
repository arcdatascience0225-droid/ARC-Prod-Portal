from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles, CurrentUser
from app.schemas.placement import (
    CompanyCreate,
    CompanyUpdate,
    CompanyOut,
    JobCreate,
    JobUpdate,
    JobOut,
    MatchRunResponse,
    ApplicationOut,
    ApplicationStatusUpdate,
    InterviewOut,
    OfferOut,
    OfferCreate,
    PlacementAnalytics,
)
from app.services.placement_service import (
    CompanyService,
    JobService,
    MatchingService,
    ApplicationService,
    OfferService,
    AnalyticsService,
)
from app.services.export_service import export_applications_csv
from app.repositories.placement_repository import ApplicationRepository, InterviewRepository

router = APIRouter(prefix="/api/v1/hr", tags=["HR Portal"])

HR_ROLES = ["hr", "placement_coordinator", "admin", "super_admin"]


# ---------------- Companies ----------------
@router.post("/companies", response_model=CompanyOut, status_code=201)
def create_company(
    data: CompanyCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return CompanyService(db).create_company(data, user.id)


@router.get("/companies", response_model=List[CompanyOut])
def list_companies(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return CompanyService(db).list_companies(skip, limit, search)


@router.get("/companies/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return CompanyService(db).get_company(company_id)


@router.put("/companies/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: UUID,
    data: CompanyUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return CompanyService(db).update_company(company_id, data)


@router.delete("/companies/{company_id}", status_code=204)
def delete_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    CompanyService(db).delete_company(company_id)
    return None


# ---------------- Jobs ----------------
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


@router.post("/jobs", response_model=JobOut, status_code=201)
def create_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    job = JobService(db).create_job(data, user.id)
    return _job_to_out(job)


@router.get("/jobs", response_model=List[JobOut])
def list_jobs(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    company_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    jobs = JobService(db).list_jobs(skip, limit, status, company_id)
    return [_job_to_out(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return _job_to_out(JobService(db).get_job(job_id))


@router.put("/jobs/{job_id}", response_model=JobOut)
def update_job(
    job_id: UUID,
    data: JobUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return _job_to_out(JobService(db).update_job(job_id, data))


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    JobService(db).delete_job(job_id)
    return None


@router.post("/jobs/{job_id}/close", response_model=JobOut)
def close_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return _job_to_out(JobService(db).close_job(job_id))


# ---------------- AI Matching / Candidate Ranking ----------------
@router.post("/jobs/{job_id}/match-candidates", response_model=MatchRunResponse)
def match_candidates(
    job_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    """Runs Gemini-based AI matching of all students against this job and ranks them."""
    result = MatchingService(db).rank_candidates_for_job(job_id, user.id)
    return result


# ---------------- Applications (candidate search / tracking) ----------------
@router.get("/applications", response_model=List[ApplicationOut])
def list_all_applications(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    apps = ApplicationService(db).list_all_applications(skip, limit)
    return [_application_to_out(a) for a in apps]


@router.get("/jobs/{job_id}/applications", response_model=List[ApplicationOut])
def list_job_applications(
    job_id: UUID,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    apps = ApplicationService(db).list_job_applications(job_id, status)
    return [_application_to_out(a) for a in apps]


@router.patch("/applications/{application_id}/status", response_model=ApplicationOut)
def update_application_status(
    application_id: UUID,
    data: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    app = ApplicationService(db).update_status(application_id, data.status)
    return _application_to_out(app)


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


# ---------------- Offers ----------------
@router.post("/offers", response_model=OfferOut, status_code=201)
def create_offer(
    data: OfferCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return OfferService(db).create_offer(data)


@router.get("/offers", response_model=List[OfferOut])
def list_offers(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return OfferService(db).list_offers()


# ---------------- Student results view (HR read-only into other phases' data) ----------------
@router.get("/candidates/{student_id}/results")
def view_candidate_results(
    student_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    """Read-only view of a candidate's assessment results and interview history for HR review."""
    from app.repositories.placement_repository import StudentProfileRepository

    student_repo = StudentProfileRepository(db)
    student = student_repo.get_student(student_id)
    results = student_repo.get_results(student_id)
    app_repo = ApplicationRepository(db)
    applications = app_repo.list_by_student(student_id)

    return {
        "studentId": str(student_id),
        "studentName": student.name if student else None,
        "assessmentResults": [
            {
                "assessmentId": str(r.assessment_id),
                "score": r.score,
                "status": r.status,
                "submittedAt": r.submitted_at.isoformat() if r.submitted_at else None,
            }
            for r in results
        ],
        "applications": [_application_to_out(a).model_dump(by_alias=True) for a in applications],
    }


# ---------------- Analytics ----------------
@router.get("/analytics", response_model=PlacementAnalytics)
def placement_analytics(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    return AnalyticsService(db).get_placement_analytics()


# ---------------- Export ----------------
@router.get("/export/applications.csv")
def export_applications(
    job_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(HR_ROLES)),
):
    if job_id:
        apps = ApplicationService(db).list_job_applications(job_id, None)
    else:
        apps = ApplicationService(db).list_all_applications(0, 10000)
    csv_content = export_applications_csv(apps, db)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=placement_report.csv"},
    )
