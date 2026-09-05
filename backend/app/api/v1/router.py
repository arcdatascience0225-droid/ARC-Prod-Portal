from fastapi import APIRouter

from app.api.v1.endpoints import (
    # Foundation (Phase 1) - routers already declare "/api/v1/..." themselves
    auth,
    registration,
    admin_users,
    # Student Portal (Phase 2) - routers already declare "/api/v1/student/..."
    student_profile,
    student_dashboard,
    student_learning,
    student_assessment,
    student_coding,
    # HR / Placement / Interview (Phase 4) - routers already declare "/api/v1/..."
    hr,
    interviews,
    student_jobs,
    # Faculty / Trainer Portal (Phase 3) - routers use short relative prefixes
    announcements,
    assessments,
    attendance,
    faculty_dashboard,
    mock_interview,
    performance,
    question_bank,
    reports,
    # Admin Portal + Analytics + Notifications + AI Assistant (Phase 5) - short prefixes
    admin_platform,
    analytics,
    notifications,
    ai_assistant,
    leads,
    fees,
)

# Group 1: routers that already declare a full "/api/v1/..." prefix on
# themselves - mount directly on the app with no extra prefix.
fully_prefixed_router = APIRouter()
for _r in (auth, registration, admin_users, hr, interviews, student_profile,
           student_dashboard, student_learning, student_assessment, student_coding,
           student_jobs):
    fully_prefixed_router.include_router(_r.router)

# Group 2: routers with only a short relative prefix (e.g. "/analytics") -
# mount under "/api/v1".
short_prefixed_router = APIRouter(prefix="/api/v1")
for _r in (announcements, assessments, attendance, faculty_dashboard, mock_interview,
           performance, question_bank, reports, admin_platform, analytics,
           notifications, ai_assistant, leads, fees):
    short_prefixed_router.include_router(_r.router)

# Combined router for convenience - app/main.py includes both groups.
api_router = APIRouter()
api_router.include_router(fully_prefixed_router)
api_router.include_router(short_prefixed_router)
