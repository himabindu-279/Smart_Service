import secrets
import json
from pathlib import Path
from typing import List, Union, Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Driven Smart Service Marketplace"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/smart_marketplace"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://smart-service-eta.vercel.app",
    ]

    # Initial Superuser
    FIRST_SUPERUSER_EMAIL: Optional[str] = None
    FIRST_SUPERUSER_PASSWORD: Optional[str] = None
    FIRST_SUPERUSER_NAME: str = "System Administrator"
    SEED_DEMO_DATA: bool = False

    # Private uploads must be stored outside every static/public directory.
    PRIVATE_UPLOAD_DIR: str = str(Path(__file__).resolve().parents[2] / "private_uploads")
    EMAIL_OUTBOX_POLL_SECONDS: int = 30
    SMS_PROVIDER: str = ""
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    SMS_OUTBOX_POLL_SECONDS: int = 15
    PROBLEM_IMAGE_MAX_BYTES: int = 5 * 1024 * 1024

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # LLM & AI Assistant Configuration
    LLM_PROVIDER: str = "openai"  # "openai", "gemini", "ollama", "local"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_BASE_URL: Optional[str] = None

    # SMTP Email Configuration
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@smartmarketplace.com"
    SMTP_USE_TLS: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        production_origin = "https://smart-service-eta.vercel.app"
        if isinstance(v, str):
            value = v.strip()
            if value.startswith("["):
                try:
                    origins = json.loads(value)
                except json.JSONDecodeError as exc:
                    raise ValueError("CORS_ORIGINS must be a valid JSON array.") from exc
            else:
                origins = [i.strip() for i in value.split(",") if i.strip()]
        elif isinstance(v, list):
            origins = v
        else:
            raise ValueError("CORS_ORIGINS must be a comma-separated list or JSON array.")
        if not isinstance(origins, list):
            raise ValueError("CORS_ORIGINS must be a list of explicit origins.")
        if any(not isinstance(origin, str) or not origin.strip() or origin.strip() == "*" for origin in origins):
            raise ValueError("CORS_ORIGINS must contain explicit origins; wildcard origins are not allowed.")
        normalized_origins = [origin.strip() for origin in origins]
        return list(dict.fromkeys([*normalized_origins, production_origin]))

    @model_validator(mode="after")
    def validate_security_settings(self):
        if self.ENVIRONMENT.lower() == "production":
            if len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be set to at least 32 characters in production.")
            if not self.FIRST_SUPERUSER_EMAIL or not self.FIRST_SUPERUSER_PASSWORD:
                raise ValueError("FIRST_SUPERUSER_EMAIL and FIRST_SUPERUSER_PASSWORD are required in production.")
            database_url = self.DATABASE_URL.lower()
            if not database_url.startswith((
                "postgres://",
                "postgresql://",
                "postgresql+psycopg://",
                "postgresql+psycopg2://",
            )):
                raise ValueError("DATABASE_URL must use PostgreSQL in production.")
        elif not self.SECRET_KEY:
            self.SECRET_KEY = secrets.token_urlsafe(48)
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
