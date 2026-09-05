from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.placement import Company, Job, Application, Interview, Offer
from app.repositories.placement_repository import (
    CompanyRepository,
    JobRepository,
    ApplicationRepository,
    InterviewRepository,
    OfferRepository,
    StudentProfileRepository,
)
from app.schemas.placement import (
    CompanyCreate,
    CompanyUpdate,
    JobCreate,
    JobUpdate,
    InterviewCreate,
    InterviewUpdate,
    OfferCreate,
    PlacementAnalytics,
)
from app.services.ai_matching_service import AIMatchingService

VALID_APPLICATION_STATUSES = [
    "applied",
    "shortlisted",
    "interview",
    "offer",
    "rejected",
    "placed",
    "withdrawn",
]


class CompanyService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CompanyRepository(db)

    def create_company(self, data: CompanyCreate, created_by: UUID) -> Company:
        company = Company(**data.model_dump(), created_by=created_by)
        return self.repo.create(company)

    def list_companies(self, skip: int, limit: int, search: Optional[str]) -> List[Company]:
        return self.repo.list(skip, limit, search)

    def get_company(self, company_id: UUID) -> Company:
        company = self.repo.get(company_id)
        if not company:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Company not found")
        return company

    def update_company(self, company_id: UUID, data: CompanyUpdate) -> Company:
        company = self.get_company(company_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(company, field, value)
        company.updated_at = datetime.utcnow()
        return self.repo.update(company)

    def delete_company(self, company_id: UUID) -> None:
        company = self.get_company(company_id)
        self.repo.delete(company)


class JobService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = JobRepository(db)
        self.company_repo = CompanyRepository(db)

    def create_job(self, data: JobCreate, posted_by: UUID) -> Job:
        if not self.company_repo.get(data.company_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Company not found")
        job = Job(**data.model_dump(), posted_by=posted_by)
        return self.repo.create(job)

    def list_jobs(
        self, skip: int, limit: int, status_filter: Optional[str], company_id: Optional[UUID]
    ) -> List[Job]:
        return self.repo.list(skip, limit, status_filter, company_id)

    def get_job(self, job_id: UUID) -> Job:
        job = self.repo.get(job_id)
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
        return job

    def update_job(self, job_id: UUID, data: JobUpdate) -> Job:
        job = self.get_job(job_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(job, field, value)
        job.updated_at = datetime.utcnow()
        return self.repo.update(job)

    def delete_job(self, job_id: UUID) -> None:
        job = self.get_job(job_id)
        self.repo.delete(job)

    def close_job(self, job_id: UUID) -> Job:
        job = self.get_job(job_id)
        job.status = "closed"
        return self.repo.update(job)


class MatchingService:
    """AI-based job-to-student matching, ranking, and recommendations."""

    def __init__(self, db: Session):
        self.db = db
        self.job_repo = JobRepository(db)
        self.student_repo = StudentProfileRepository(db)
        self.ai = AIMatchingService(db)

    def _build_student_profile(self, student) -> dict:
        results = self.student_repo.get_results(student.id)
        avg_score = self.student_repo.get_avg_score(student.id) or 0
        # In the merged system, skills would come from a student profile/resume table
        # (owned by another phase). Until that exists, we derive a lightweight signal
        # from completed assessment count as a placeholder heuristic input to Gemini.
        return {
            "name": student.name,
            "skills": [],
            "avg_assessment_score": round(float(avg_score), 2),
            "completed_assessments": len(results),
            "coding_languages": [],
            "recent_activity_summary": f"{len(results)} assessments completed",
        }

    def rank_candidates_for_job(self, job_id: UUID, requesting_user_id: UUID) -> dict:
        job = self.job_repo.get(job_id)
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
        students = self.student_repo.list_students()
        candidates = []
        for s in students:
            profile = self._build_student_profile(s)
            profile["student_id"] = s.id
            profile["student_email"] = s.email
            candidates.append(profile)

        ranked = self.ai.rank_candidates_for_job(job, candidates, requesting_user_id)
        matches = [
            {
                "studentId": r["student_id"],
                "studentName": r["name"],
                "studentEmail": r["student_email"],
                "matchScore": r["matchScore"],
                "matchReasoning": r["reasoning"],
                "avgAssessmentScore": r.get("avg_assessment_score"),
                "skillsMatched": r.get("skillsMatched", []),
                "skillsMissing": r.get("skillsMissing", []),
            }
            for r in ranked
        ]
        return {"jobId": job_id, "totalCandidatesEvaluated": len(candidates), "matches": matches}

    def recommend_jobs_for_student(self, student_id: UUID, limit: int = 10) -> List[dict]:
        student = self.student_repo.get_student(student_id)
        if not student:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
        profile = self._build_student_profile(student)
        from app.repositories.batch_repository import BatchRepository
        student_batch_ids = [str(b) for b in BatchRepository(self.db).batch_ids_for_student(student_id)]
        open_jobs = self.job_repo.list(skip=0, limit=200, status="open")
        scored = []
        for job in open_jobs:
            # Batch targeting: if job has target_batch_ids, only students in those batches see it
            target = getattr(job, 'target_batch_ids', None)
            if isinstance(target, list) and target:
                if not any(str(b) in student_batch_ids for b in target):
                    continue
            match = self.ai.match_student_to_job(job, profile, student_id)
            scored.append({"job": job, **match})
        scored.sort(key=lambda x: x["matchScore"], reverse=True)
        return scored[:limit]


class ApplicationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ApplicationRepository(db)
        self.job_repo = JobRepository(db)
        self.matching = MatchingService(db)

    def apply_to_job(self, job_id: UUID, student_id: UUID) -> Application:
        job = self.job_repo.get(job_id)
        if not job:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
        if job.status != "open":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This job is not accepting applications")
        existing = self.repo.get_by_job_and_student(job_id, student_id)
        if existing:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already applied to this job")

        student = self.matching.student_repo.get_student(student_id)
        profile = self.matching._build_student_profile(student)
        match = self.matching.ai.match_student_to_job(job, profile, student_id)

        application = Application(
            job_id=job_id,
            student_id=student_id,
            match_score=match["matchScore"],
            match_reasoning=match["reasoning"],
            status="applied",
        )
        return self.repo.create(application)

    def get_application(self, application_id: UUID) -> Application:
        app = self.repo.get(application_id)
        if not app:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
        return app

    def list_student_applications(self, student_id: UUID) -> List[Application]:
        return self.repo.list_by_student(student_id)

    def list_job_applications(self, job_id: UUID, status_filter: Optional[str]) -> List[Application]:
        return self.repo.list_by_job(job_id, status_filter)

    def list_all_applications(self, skip: int, limit: int) -> List[Application]:
        return self.repo.list_all(skip, limit)

    def update_status(self, application_id: UUID, new_status: str) -> Application:
        if new_status not in VALID_APPLICATION_STATUSES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid application status")
        app = self.get_application(application_id)
        app.status = new_status
        app.updated_at = datetime.utcnow()
        return self.repo.update(app)

    def withdraw(self, application_id: UUID, student_id: UUID) -> Application:
        app = self.get_application(application_id)
        if app.student_id != student_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your application")
        app.status = "withdrawn"
        app.updated_at = datetime.utcnow()
        return self.repo.update(app)


class InterviewService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = InterviewRepository(db)
        self.app_repo = ApplicationRepository(db)
        self.job_repo = JobRepository(db)
        self.ai = AIMatchingService(db)

    def schedule_interview(self, data: InterviewCreate, scheduled_by: UUID) -> Interview:
        application = self.app_repo.get(data.application_id)
        if not application:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
        interview = Interview(**data.model_dump())
        created = self.repo.create(interview)
        application.status = "interview"
        application.updated_at = datetime.utcnow()
        self.app_repo.update(application)
        return created

    def get_interview(self, interview_id: UUID) -> Interview:
        interview = self.repo.get(interview_id)
        if not interview:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Interview not found")
        return interview

    def list_for_application(self, application_id: UUID) -> List[Interview]:
        return self.repo.list_by_application(application_id)

    def list_for_student(self, student_id: UUID) -> List[Interview]:
        return self.repo.list_upcoming_for_student(student_id)

    def list_for_interviewer(self, interviewer_id: UUID) -> List[Interview]:
        return self.repo.list_by_interviewer(interviewer_id)

    def update_interview(self, interview_id: UUID, data: InterviewUpdate) -> Interview:
        interview = self.get_interview(interview_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(interview, field, value)
        interview.updated_at = datetime.utcnow()
        return self.repo.update(interview)

    def submit_feedback(
        self, interview_id: UUID, feedback: str, rating: int
    ) -> Interview:
        interview = self.get_interview(interview_id)
        interview.interviewer_feedback = feedback
        interview.interviewer_rating = rating
        interview.status = "completed"
        interview.updated_at = datetime.utcnow()
        return self.repo.update(interview)

    def analyze_transcript(
        self, interview_id: UUID, transcript: str, requesting_user_id: UUID
    ) -> Interview:
        interview = self.get_interview(interview_id)
        application = self.app_repo.get(interview.application_id)
        job = self.job_repo.get(application.job_id)
        analysis = self.ai.analyze_interview(transcript, job, requesting_user_id)
        interview.transcript = transcript
        interview.ai_score = analysis["score"]
        interview.ai_analysis = {
            "strengths": analysis["strengths"],
            "weaknesses": analysis["weaknesses"],
            "summary": analysis["summary"],
        }
        interview.updated_at = datetime.utcnow()
        return self.repo.update(interview)


class OfferService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = OfferRepository(db)
        self.app_repo = ApplicationRepository(db)

    def create_offer(self, data: OfferCreate) -> Offer:
        application = self.app_repo.get(data.application_id)
        if not application:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
        if self.repo.get_by_application(data.application_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Offer already exists for this application")
        offer = Offer(**data.model_dump())
        created = self.repo.create(offer)
        application.status = "offer"
        application.updated_at = datetime.utcnow()
        self.app_repo.update(application)
        return created

    def get_offer(self, offer_id: UUID) -> Offer:
        offer = self.repo.get(offer_id)
        if not offer:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Offer not found")
        return offer

    def list_offers(self) -> List[Offer]:
        return self.repo.list_all()

    def respond_to_offer(self, offer_id: UUID, student_id: UUID, new_status: str) -> Offer:
        if new_status not in ("accepted", "declined"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Status must be accepted or declined")
        offer = self.get_offer(offer_id)
        application = self.app_repo.get(offer.application_id)
        if application.student_id != student_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your offer")
        offer.status = new_status
        offer.responded_at = datetime.utcnow()
        self.repo.update(offer)
        application.status = "placed" if new_status == "accepted" else "rejected"
        application.updated_at = datetime.utcnow()
        self.app_repo.update(application)
        return offer


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db
        self.app_repo = ApplicationRepository(db)
        self.interview_repo = InterviewRepository(db)
        self.offer_repo = OfferRepository(db)
        self.student_repo = StudentProfileRepository(db)

    def get_placement_analytics(self) -> PlacementAnalytics:
        total_students = len(self.student_repo.list_students())
        total_applications = self.app_repo.count_all()
        total_interviews = self.interview_repo.count_all()
        total_offers = self.offer_repo.count_all()
        total_placed = self.app_repo.count_by_status("placed")
        placement_rate = (
            round((total_placed / total_students) * 100, 2) if total_students else 0.0
        )
        avg_salary = self.offer_repo.avg_salary()
        max_salary = self.offer_repo.max_salary()

        status_funnel = {
            s: self.app_repo.count_by_status(s)
            for s in VALID_APPLICATION_STATUSES
        }

        company_hires: dict = {}
        for app in self.app_repo.list_all(skip=0, limit=10000):
            if app.status == "placed":
                company_name = app.job.company.name if app.job and app.job.company else "Unknown"
                company_hires[company_name] = company_hires.get(company_name, 0) + 1

        return PlacementAnalytics(
            total_students=total_students,
            total_applications=total_applications,
            total_interviews=total_interviews,
            total_offers=total_offers,
            total_placed=total_placed,
            placement_rate_percent=placement_rate,
            avg_salary_offered=float(avg_salary) if avg_salary else None,
            highest_salary_offered=float(max_salary) if max_salary else None,
            company_wise_hires=company_hires,
            status_funnel=status_funnel,
        )
