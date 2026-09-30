from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user, require_admin, get_db
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def read_current_user(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get details of the currently authenticated user.
    Includes provider profile information if user role is PROVIDER.
    """
    return current_user


@router.get("/", response_model=List[UserResponse], dependencies=[Depends(require_admin)])
def read_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Admin-only endpoint: List all registered users and providers.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users
