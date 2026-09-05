from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.router import api_router
from app.services.gemini_client import GeminiNotConfiguredError

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
    allow_origin_regex=r"https://.*\.vercel\.app",
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
