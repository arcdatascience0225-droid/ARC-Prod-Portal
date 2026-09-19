from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.router import api_router
from app.services.gemini_client import GeminiNotConfiguredError

# SECURITY: refuse to boot against a real (non-localhost) database while
# still using the placeholder JWT secret. That default is public (it's
# right here in the open-source repo) — running with it live would let
# anyone forge a valid token for any user, including super_admin, just by
# signing their own JWT with this known string. A genuinely local dev
# setup (localhost DB) is still allowed to use it for convenience.
if settings.JWT_SECRET_KEY == "change_this_secret" and "localhost" not in settings.DATABASE_URL:
    raise RuntimeError(
        "JWT_SECRET_KEY is still set to the placeholder default. Set a real, "
        "random JWT_SECRET_KEY environment variable before starting this "
        "service against a non-local database."
    )

app = FastAPI(
    title="AI Learning, Assessment & Placement Platform",
    version="1.0.0",
    description=(
        "Unified backend: Foundation/Auth, Student Portal, Faculty/Trainer Portal, "
        "HR/Placement/Interview, and Admin Portal + Analytics + Notifications + AI Assistant."
    ),
)

_frontend_url = settings.FRONTEND_URL.rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_url, "http://localhost:5173", "http://localhost:3000"],
    # Scoped to THIS project's preview deployments only (e.g.
    # arc-prod-portal-<hash>.vercel.app) — not any *.vercel.app site, which
    # anyone can register for free and which would otherwise be allowed to
    # make credentialed requests here.
    allow_origin_regex=r"https://arc-prod-portal.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(GeminiNotConfiguredError)
def gemini_not_configured_handler(request: Request, exc: GeminiNotConfiguredError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


app.include_router(api_router)


@app.get("/api/v1/health", tags=["Health"])
def health_check():
    return {"status": "ok", "env": settings.ENV}
