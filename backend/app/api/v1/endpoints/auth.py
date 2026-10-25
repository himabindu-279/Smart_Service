from typing import Optional
from fastapi import APIRouter, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import UserCreate
from app.schemas.token import Token, LoginRequest
from app.models.enums import UserRole
from app.services.auth_service import AuthService

router = APIRouter()


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
