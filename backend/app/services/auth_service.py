from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.models.provider import Provider
from app.models.enums import UserRole
from app.schemas.user import UserCreate
from app.schemas.token import Token


class AuthService:
    @staticmethod
    def register_user(db: Session, user_in: UserCreate) -> Tuple[User, Token]:
        # Check if email is already registered
        existing_user = db.query(User).filter(User.email == user_in.email.lower().strip()).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists."
            )

        # Admin cannot be registered via public registration endpoint
        if user_in.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator accounts cannot be registered via public endpoint."
            )

        hashed_password = get_password_hash(user_in.password)
        db_user = User(
            email=user_in.email.lower().strip(),
            hashed_password=hashed_password,
            full_name=user_in.full_name.strip(),
            phone=user_in.phone.strip() if user_in.phone else None,
            role=user_in.role,
            is_active=True
        )
        db.add(db_user)
        db.flush()  # to obtain db_user.id

        # If registering as a service provider, initialize provider profile
        if user_in.role == UserRole.PROVIDER:
            provider = Provider(
                user_id=db_user.id,
                business_name=user_in.business_name or user_in.full_name,
                bio=user_in.bio,
                experience_years=user_in.experience_years or 0,
                qualifications=user_in.qualifications,
                address=user_in.address,
                latitude=user_in.latitude,
                longitude=user_in.longitude,
                is_verified=False,
                is_available=True,
                rating_avg=0.0,
                total_ratings=0
            )
            db.add(provider)

        db.commit()
        db.refresh(db_user)

        # Generate JWT
        token = AuthService.generate_token_for_user(db_user)
        return db_user, token

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Tuple[User, Token]:
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is inactive. Please contact support."
            )

        token = AuthService.generate_token_for_user(user)
        return user, token

    @staticmethod
    def generate_token_for_user(user: User) -> Token:
        extra_claims = {
            "email": user.email,
            "role": user.role.value,
            "full_name": user.full_name
        }
        if user.provider_profile:
            extra_claims["provider_id"] = user.provider_profile.id

        access_token = create_access_token(
            subject=user.id,
            extra_claims=extra_claims
        )

        user_data = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role.value,
            "is_active": user.is_active,
            "provider_id": user.provider_profile.id if user.provider_profile else None
        }

        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user_data
        )
