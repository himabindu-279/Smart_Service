import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.provider import Provider
from app.models.provider_service import ProviderService
from app.models.service import Service
from app.models.category import Category
from app.models.user import User
from app.models.review import Review
from app.models.enums import ServiceApprovalStatus, UserRole
from app.api.deps import get_current_active_user, require_provider
from app.utils.geo import haversine_distance, geocode_location

router = APIRouter()


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[-\s]+', '-', text)


@router.get("")
@router.get("/")
def list_providers(
    service_id: Optional[int] = None,
    query: Optional[str] = None,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    List service providers with optional service filtering and distance computation.
    Only returns providers who offer APPROVED and ACTIVE services in the marketplace.
    """
    q = db.query(Provider).filter(Provider.is_available == True)

    if service_id:
        q = q.join(ProviderService).filter(
            ProviderService.service_id == service_id,
            ProviderService.is_active == True,
            ProviderService.status == ServiceApprovalStatus.APPROVED
        )
    else:
        # Only show providers with at least one approved service
        q = q.join(ProviderService).filter(
            ProviderService.is_active == True,
            ProviderService.status == ServiceApprovalStatus.APPROVED
        ).distinct()

    providers = q.all()
    results = []

    for p in providers:
        user = db.query(User).filter(User.id == p.user_id).first()
        if not user or not user.is_active:
            continue

        # Filter strictly to APPROVED and ACTIVE services for customers
        p_services = (
            db.query(ProviderService, Service)
            .join(Service, ProviderService.service_id == Service.id)
            .filter(
                ProviderService.provider_id == p.id,
                ProviderService.is_active == True,
                ProviderService.status == ServiceApprovalStatus.APPROVED
            )
            .all()
        )
        if not p_services:
            continue

        services_list = [
            {
                "provider_service_id": ps.id,
                "service_id": s.id,
                "name": ps.custom_service_name or s.name,
                "slug": s.slug,
                "custom_price": ps.custom_price,
                "description": ps.description or s.description,
                "experience": ps.experience or f"{p.experience_years} years",
                "service_location": ps.service_location or p.address,
                "service_radius_km": ps.service_radius_km or 15.0,
                "availability": ps.availability_hours or "Available Today",
                "status": ps.status.value,
                "image_url": ps.image_url
            }
            for ps, s in p_services
        ]

        # Calculate distance if coordinates provided
        distance = None
        if user_lat is not None and user_lon is not None and p.latitude and p.longitude:
            distance = haversine_distance(user_lat, user_lon, p.latitude, p.longitude)

        # Query filter
        if query:
            q_lower = query.lower()
            name_match = (p.business_name and q_lower in p.business_name.lower()) or (user.full_name and q_lower in user.full_name.lower())
            svc_match = any(q_lower in s["name"].lower() for s in services_list)
            if not name_match and not svc_match:
                continue

        results.append({
            "id": p.id,
            "user_id": p.user_id,
            "name": user.full_name,
            "business_name": p.business_name or user.full_name,
            "bio": p.bio,
            "experience_years": p.experience_years,
            "qualifications": p.qualifications,
            "address": p.address,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "is_verified": p.is_verified,
            "is_available": p.is_available,
            "rating_avg": p.rating_avg or 4.5,
            "total_ratings": p.total_ratings or 1,
            "distance_km": distance,
            "services": services_list
        })

    return results


@router.get("/{provider_id}")
def get_provider_detail(provider_id: int, db: Session = Depends(get_db)):
    """Retrieve full provider profile details with offered services and reviews."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    user = db.query(User).filter(User.id == provider.user_id).first()

    # Approved services
    p_services = (
        db.query(ProviderService, Service)
        .join(Service, ProviderService.service_id == Service.id)
        .filter(
            ProviderService.provider_id == provider.id,
            ProviderService.is_active == True,
            ProviderService.status == ServiceApprovalStatus.APPROVED
        )
        .all()
    )
    services_list = [
        {
            "provider_service_id": ps.id,
            "service_id": s.id,
            "name": ps.custom_service_name or s.name,
            "category_name": s.category.name if s.category else None,
            "custom_price": ps.custom_price,
            "description": ps.description or s.description,
            "experience": ps.experience,
            "service_location": ps.service_location,
            "service_radius_km": ps.service_radius_km,
            "availability": ps.availability_hours,
            "estimated_duration_minutes": s.estimated_duration_minutes,
            "image_url": ps.image_url
        }
        for ps, s in p_services
    ]

    # Reviews
    reviews = db.query(Review).filter(Review.provider_id == provider.id).order_by(Review.created_at.desc()).limit(15).all()
    reviews_list = [
        {
            "id": r.id,
            "user_name": r.user.full_name if r.user else "Customer",
            "review_text": r.review_text,
            "sentiment": r.sentiment or "POSITIVE",
            "sentiment_score": r.sentiment_score or 0.95,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in reviews
    ]

    return {
        "id": provider.id,
        "user_id": provider.user_id,
        "name": user.full_name if user else "Specialist",
        "business_name": provider.business_name or (user.full_name if user else "Specialist"),
        "bio": provider.bio,
        "experience_years": provider.experience_years,
        "qualifications": provider.qualifications,
        "profile_image": provider.profile_image,
        "address": provider.address,
        "latitude": provider.latitude,
        "longitude": provider.longitude,
        "is_verified": provider.is_verified,
        "is_available": provider.is_available,
        "rating_avg": provider.rating_avg or 4.8,
        "total_ratings": provider.total_ratings or 24,
        "services": services_list,
        "reviews": reviews_list
    }


# ========================================================
# PROVIDER SELF MANAGEMENT & SERVICE PUBLISHING ENDPOINTS
# ========================================================

class ProviderProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    qualifications: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_available: Optional[bool] = None


class PublishServiceRequest(BaseModel):
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    service_id: Optional[int] = None
    service_name: str
    description: Optional[str] = None
    experience: Optional[str] = None
    base_price: float = Field(..., gt=0)
    service_location: Optional[str] = None
    service_radius: Optional[float] = 15.0
    availability: Optional[str] = "Monday - Saturday, 9:00 AM - 7:00 PM"
    image_url: Optional[str] = None
    is_active: Optional[bool] = True


@router.get("/me/profile")
def get_my_provider_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get profile and all services (including pending/rejected) of the currently logged-in provider."""
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found for this user.")

    # Provider sees all their services with real approval status
    p_services = (
        db.query(ProviderService, Service)
        .join(Service, ProviderService.service_id == Service.id)
        .filter(ProviderService.provider_id == provider.id)
        .order_by(ProviderService.created_at.desc())
        .all()
    )
    services_list = [
        {
            "id": ps.id,
            "provider_service_id": ps.id,
            "service_id": s.id,
            "service_name": ps.custom_service_name or s.name,
            "category_name": s.category.name if s.category else (ps.category.name if ps.category else "General"),
            "category_id": s.category_id or (ps.category_id if ps.category else None),
            "custom_price": ps.custom_price,
            "base_price": ps.custom_price,
            "description": ps.description or s.description,
            "experience": ps.experience,
            "service_location": ps.service_location or provider.address,
            "service_radius": ps.service_radius_km,
            "availability": ps.availability_hours,
            "status": ps.status.value,
            "is_active": ps.is_active,
            "rejection_reason": ps.rejection_reason,
            "image_url": ps.image_url,
            "created_at": ps.created_at.isoformat()
        }
        for ps, s in p_services
    ]

    return {
        "id": provider.id,
        "user_id": provider.user_id,
        "name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "business_name": provider.business_name or current_user.full_name,
        "bio": provider.bio,
        "experience_years": provider.experience_years,
        "qualifications": provider.qualifications,
        "address": provider.address,
        "latitude": provider.latitude,
        "longitude": provider.longitude,
        "is_verified": provider.is_verified,
        "is_available": provider.is_available,
        "rating_avg": provider.rating_avg,
        "total_ratings": provider.total_ratings,
        "services": services_list
    }


@router.put("/me/profile")
def update_my_provider_profile(
    profile_in: ProviderProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update profile details for the currently logged-in provider."""
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found.")

    profile_data = profile_in.model_dump(exclude_unset=True)
    if "address" in profile_data and profile_data["address"]:
        matches = geocode_location(profile_data["address"])
        if not matches:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="We could not find that service location. Choose a recognized city or area.",
            )
        location = matches[0]
        profile_data["address"] = location["display_name"]
        profile_data["latitude"] = location["latitude"]
        profile_data["longitude"] = location["longitude"]

    for field, val in profile_data.items():
        setattr(provider, field, val)

    db.commit()
    db.refresh(provider)
    return {"message": "Provider profile updated successfully", "provider_id": provider.id}


@router.get("/me/services")
def get_my_provider_services(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retrieve all services published by the logged-in provider with their approval statuses."""
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found.")

    p_services = (
        db.query(ProviderService, Service)
        .join(Service, ProviderService.service_id == Service.id)
        .filter(ProviderService.provider_id == provider.id)
        .order_by(ProviderService.created_at.desc())
        .all()
    )

    return [
        {
            "id": ps.id,
            "service_id": s.id,
            "service_name": ps.custom_service_name or s.name,
            "category_name": s.category.name if s.category else (ps.category.name if ps.category else "General"),
            "category_id": s.category_id,
            "base_price": ps.custom_price,
            "custom_price": ps.custom_price,
            "description": ps.description or s.description,
            "experience": ps.experience or f"{provider.experience_years} years",
            "service_location": ps.service_location or provider.address,
            "service_radius": ps.service_radius_km,
            "availability": ps.availability_hours,
            "status": ps.status.value,
            "is_active": ps.is_active,
            "rejection_reason": ps.rejection_reason,
            "image_url": ps.image_url,
            "created_at": ps.created_at.isoformat()
        }
        for ps, s in p_services
    ]


@router.post("/me/services", status_code=status.HTTP_201_CREATED)
def publish_provider_service(
    svc_in: PublishServiceRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Provider publishes a service offering.
    Status starts as PENDING until reviewed and APPROVED by Admin.
    """
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found. Please complete provider onboarding.")

    # 1. Resolve Category
    category = None
    if svc_in.category_id:
        category = db.query(Category).filter(Category.id == svc_in.category_id).first()
    elif svc_in.category_name:
        category = db.query(Category).filter(Category.name.ilike(f"%{svc_in.category_name}%")).first()

    if not category:
        category = db.query(Category).first()

    # 2. Resolve Service
    service = None
    if svc_in.service_id:
        service = db.query(Service).filter(Service.id == svc_in.service_id).first()
    else:
        # Match by name or create service in database
        clean_name = svc_in.service_name.strip()
        service = db.query(Service).filter(Service.name.ilike(clean_name)).first()
        if not service:
            base_slug = slugify(clean_name)
            slug = base_slug
            idx = 1
            while db.query(Service).filter(Service.slug == slug).first():
                slug = f"{base_slug}-{idx}"
                idx += 1

            service = Service(
                category_id=category.id if category else 1,
                name=clean_name,
                slug=slug,
                description=svc_in.description or f"Professional {clean_name} services.",
                base_price=svc_in.base_price,
                estimated_duration_minutes=60,
                is_active=True
            )
            db.add(service)
            db.commit()
            db.refresh(service)

    # Resolve the provider's service location once and keep the provider
    # coordinates aligned with the location customers search.
    service_location = svc_in.service_location or provider.address
    if service_location:
        matches = geocode_location(service_location)
        if not matches:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="We could not find that service location. Choose a recognized city or area.",
            )
        location = matches[0]
        service_location = location["display_name"]
        provider.address = service_location
        provider.latitude = location["latitude"]
        provider.longitude = location["longitude"]

    # 3. Add or update ProviderService record
    existing_ps = db.query(ProviderService).filter(
        ProviderService.provider_id == provider.id,
        ProviderService.service_id == service.id
    ).first()

    if existing_ps:
        existing_ps.custom_price = svc_in.base_price
        existing_ps.custom_service_name = svc_in.service_name
        existing_ps.description = svc_in.description
        existing_ps.experience = svc_in.experience
        existing_ps.service_location = service_location
        existing_ps.service_radius_km = svc_in.service_radius or 15.0
        existing_ps.availability_hours = svc_in.availability
        existing_ps.image_url = svc_in.image_url
        existing_ps.category_id = category.id if category else service.category_id
        existing_ps.status = ServiceApprovalStatus.PENDING  # Reset to PENDING for review
        existing_ps.is_active = svc_in.is_active if svc_in.is_active is not None else True
        existing_ps.rejection_reason = None
        db.commit()
        db.refresh(existing_ps)
        ps_record = existing_ps
    else:
        ps_record = ProviderService(
            provider_id=provider.id,
            service_id=service.id,
            category_id=category.id if category else service.category_id,
            custom_service_name=svc_in.service_name,
            custom_price=svc_in.base_price,
            description=svc_in.description,
            experience=svc_in.experience,
            service_location=service_location,
            service_radius_km=svc_in.service_radius or 15.0,
            availability_hours=svc_in.availability,
            image_url=svc_in.image_url,
            status=ServiceApprovalStatus.PENDING,
            is_active=svc_in.is_active if svc_in.is_active is not None else True
        )
        db.add(ps_record)
        db.commit()
        db.refresh(ps_record)

    return {
        "id": ps_record.id,
        "service_name": service.name,
        "status": ps_record.status.value,
        "price": ps_record.custom_price,
        "message": f"Service '{svc_in.service_name}' submitted successfully and is PENDING administrator review."
    }


@router.patch("/me/services/{ps_id}/toggle-active")
def toggle_provider_service_active(
    ps_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Provider toggles their service ACTIVE or INACTIVE."""
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    ps = db.query(ProviderService).filter(
        ProviderService.id == ps_id,
        ProviderService.provider_id == provider.id
    ).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Service offering not found.")

    ps.is_active = not ps.is_active
    db.commit()
    db.refresh(ps)
    return {
        "id": ps.id,
        "is_active": ps.is_active,
        "status": ps.status.value,
        "message": f"Service is now {'ACTIVE' if ps.is_active else 'INACTIVE'}"
    }


@router.delete("/me/services/{ps_id}")
def delete_provider_service(
    ps_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a service offering from provider profile."""
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found.")

    ps = db.query(ProviderService).filter(
        ProviderService.id == ps_id,
        ProviderService.provider_id == provider.id
    ).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Service offering not found.")

    db.delete(ps)
    db.commit()
    return {"message": "Service offering removed successfully"}
