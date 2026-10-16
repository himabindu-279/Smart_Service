from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user, require_admin, get_db
from app.core.security import get_password_hash
from app.models.location import Location
from app.models.user import User
from app.schemas.location import LocationCreate, LocationResponse
from app.schemas.user import UserResponse, UserUpdate

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


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    updates = user_update.model_dump(exclude_unset=True)
    password = updates.pop("password", None)
    if password:
        current_user.hashed_password = get_password_hash(password)
    for field, value in updates.items():
        setattr(current_user, field, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/location", response_model=LocationResponse | None)
def read_primary_location(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Location)
        .filter(Location.user_id == current_user.id, Location.is_primary == True)
        .first()
    )


@router.put("/me/location", response_model=LocationResponse)
def save_primary_location(
    location_data: LocationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    locations = db.query(Location).filter(Location.user_id == current_user.id).all()
    primary_location = next((location for location in locations if location.is_primary), None)
    if primary_location is None:
        primary_location = Location(user_id=current_user.id, is_primary=True)
        db.add(primary_location)

    for location in locations:
        location.is_primary = location.id == primary_location.id

    for field, value in location_data.model_dump(exclude={"is_primary"}).items():
        setattr(primary_location, field, value)
    primary_location.is_primary = True

    db.commit()
    db.refresh(primary_location)
    return primary_location


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
