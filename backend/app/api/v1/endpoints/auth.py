import hashlib
import hmac
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import UserCreate
from app.schemas.token import Token, LoginRequest
from app.models.enums import UserRole
from app.services.auth_service import AuthService
from app.models.email_verification import EmailVerification
from app.core.config import settings
from app.services.email_service import EmailService

router = APIRouter()


class ProviderEmailRequest(BaseModel):
    email: EmailStr


class ProviderEmailCode(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^[0-9]{6}$")


def _code_digest(email: str, code: str) -> str:
    message = f"{email.casefold()}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


@router.post("/provider-email-challenge", status_code=status.HTTP_202_ACCEPTED)
def send_provider_email_challenge(
    payload: ProviderEmailRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().casefold()
    challenge = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    now = datetime.now(timezone.utc)
    if challenge and challenge.last_sent_at:
        last_sent = challenge.last_sent_at
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        if now - last_sent < timedelta(seconds=60):
            raise HTTPException(status_code=429, detail="Wait 60 seconds before requesting another code.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    if not challenge:
        challenge = EmailVerification(email=email, code_hash=_code_digest(email, code), expires_at=now + timedelta(minutes=15))
        db.add(challenge)
    else:
        challenge.code_hash = _code_digest(email, code)
        challenge.expires_at = now + timedelta(minutes=15)
        challenge.verified_at = None
        challenge.attempts = 0
        challenge.last_sent_at = now
    db.commit()

    try:
        EmailService.send_verification_code(email, code)
    except (OSError, RuntimeError, smtplib.SMTPException) as exc:
        challenge.last_sent_at = now - timedelta(seconds=60)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email verification is unavailable. Configure the backend SMTP settings and retry.",
        ) from exc
    return {"message": "A verification code was sent to the provided email address."}


@router.post("/provider-email-verify")
def verify_provider_email(
    payload: ProviderEmailCode,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().casefold()
    challenge = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    if not challenge:
        raise HTTPException(status_code=400, detail="Request an email verification code first.")
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc) or challenge.attempts >= 5:
        raise HTTPException(status_code=400, detail="The verification code expired. Request a new code.")
    if not hmac.compare_digest(challenge.code_hash, _code_digest(email, payload.code)):
        challenge.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="The verification code is incorrect.")
    challenge.verified_at = datetime.now(timezone.utc)
    db.commit()
    return {"verified": True, "message": "Email address verified."}


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new USER or PROVIDER.
    
    If role == 'PROVIDER', creates both the user account and associated provider profile.
    """
    _, token = AuthService.register_user(db=db, user_in=user_in)
    return token


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Authenticate user via JSON body ({"email": "...", "password": "..."})
    or standard OAuth2 form-data (username="...", password="...").
    """
    content_type = request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        body = await request.json()
        email = body.get("email") or body.get("username")
        password = body.get("password")
        role = body.get("role")
    else:
        # Form data fallback
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")
        role = form.get("role")

    if not email or not password:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required."
        )

    try:
        requested_role = UserRole(role) if role else None
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be USER, PROVIDER, or ADMIN.",
        )
    _, token = AuthService.authenticate_user(
        db=db,
        email=email,
        password=password,
        requested_role=requested_role,
    )
    return token
