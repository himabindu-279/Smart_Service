from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from app.models.provider import Provider
from app.models.enums import UserRole
from app.models.enums import ServiceApprovalStatus
from app.models.provider_service import ProviderService
from app.models.service import Service
from app.models.email_verification import EmailVerification
from app.schemas.user import UserCreate
from app.schemas.token import Token
from app.services.notification_service import NotificationService


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

        verification = None
        if user_in.role == UserRole.PROVIDER:
            if not user_in.phone or len(user_in.phone.strip()) < 8:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="A valid provider phone number is required.",
                )
            if not user_in.address or not user_in.address.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="A provider address is required.",
                )
            verification = db.query(EmailVerification).filter(
                EmailVerification.email == user_in.email.lower().strip(),
                EmailVerification.verified_at.isnot(None),
            ).first()
            if not verification or _as_utc(verification.expires_at) <= datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verify this email address before registering as a provider.",
                )
            if not user_in.offered_services:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Select at least one service and provide its price and coverage location.",
                )
            for offering in user_in.offered_services:
                service = db.query(Service).filter(
                    Service.id == offering.service_id,
                    Service.is_active.is_(True),
                ).first()
                if not service:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Service {offering.service_id} is not in the active service catalog.",
                    )

        hashed_password = get_password_hash(user_in.password)
        db_user = User(
            email=user_in.email.lower().strip(),
            hashed_password=hashed_password,
            full_name=user_in.full_name.strip(),
            phone=user_in.phone.strip() if user_in.phone else None,
            role=user_in.role,
            is_active=True,
            email_verified_at=verification.verified_at if verification else None,
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
                address=user_in.offered_services[0].service_location if user_in.offered_services else user_in.address,
                latitude=user_in.offered_services[0].latitude if user_in.offered_services else user_in.latitude,
                longitude=user_in.offered_services[0].longitude if user_in.offered_services else user_in.longitude,
                service_radius_km=user_in.offered_services[0].service_radius_km if user_in.offered_services else 15.0,
                is_verified=False,
                verification_status="PENDING",
                is_available=False,
                rating_avg=0.0,
                total_ratings=0
            )
            db.add(provider)
            db.flush()
            for offering in user_in.offered_services:
                service = db.query(Service).filter(Service.id == offering.service_id).first()
                db.add(ProviderService(
                    provider_id=provider.id,
                    service_id=service.id,
                    category_id=service.category_id,
                    custom_service_name=service.name,
                    description=offering.description,
                    experience=f"{user_in.experience_years or 0} years",
                    custom_price=offering.base_price,
                    service_location=offering.service_location.strip(),
                    service_latitude=offering.latitude,
                    service_longitude=offering.longitude,
                    service_radius_km=offering.service_radius_km,
                    availability_hours=offering.availability_hours,
                    status=ServiceApprovalStatus.PENDING,
                    is_active=False,
                ))
            NotificationService.provider_registered(
                db,
                db_user,
                provider.business_name or db_user.full_name,
            )

        db.commit()
        db.refresh(db_user)

        # Generate JWT
        token = AuthService.generate_token_for_user(db_user)
        return db_user, token

    @staticmethod
    def authenticate_user(
        db: Session,
        email: str,
        password: str,
        requested_role: Optional[UserRole] = None,
    ) -> Tuple[User, Token]:
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
        if requested_role is not None and user.role != requested_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This account is registered as {user.role.value}. Select the matching role to sign in.",
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
            "preferred_language": user.preferred_language,
            "role": user.role.value,
            "is_active": user.is_active,
            "provider_id": user.provider_profile.id if user.provider_profile else None
        }

        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user_data
        )


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
