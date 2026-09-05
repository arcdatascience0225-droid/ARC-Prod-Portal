from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "AI Learning, Assessment & Placement Platform"
    API_V1_PREFIX: str = "/api/v1"
    ENV: str = "development"

    # Database / Cache
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/platform"
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT (shared across every phase - single secret/algorithm)
    JWT_SECRET_KEY: str = "change_this_secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Alias kept for phase5 code that reads JWT_EXPIRE_MINUTES
    JWT_EXPIRE_MINUTES: int = 30

    # Azure Blob Storage
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_STORAGE_CONTAINER: str = "platform-uploads"
    AZURE_STORAGE_CONTAINER_RECORDINGS: str = "mock-interview-recordings"
    AZURE_STORAGE_CONTAINER_REPORTS: str = "reports"

    # Gemini (AI)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"  # gemini-2.5-flash is restricted to pre-existing users only (not available to new API keys) — this is Google's own recommended replacement

    # Groq (alternative AI provider - genuinely free tier, no credit card
    # required; runs open-source models like Llama on fast LPU hardware).
    # Not to be confused with "Grok" (xAI), which does not have a free tier.
    AI_PROVIDER: str = "gemini"  # "gemini" or "groq"
    GROQ_API_KEY: str = ""
    # llama-3.3-70b-versatile was deprecated by Groq on 2026-06-17; this is
    # their recommended replacement (openai/gpt-oss-120b), which also
    # handles the JSON-mode question generation prompts reliably.
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    # Judge0 (code execution)
    JUDGE0_API_URL: str = "https://judge0-ce.p.rapidapi.com"
    JUDGE0_API_KEY: str = ""
    JUDGE0_API_HOST: str = "judge0-ce.p.rapidapi.com"

    # Email
    SENDGRID_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "no-reply@platform.com"

    # SMS
    SMS_PROVIDER_API_KEY: str = ""

    # Misc
    FACE_RECOGNITION_SERVICE_URL: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
