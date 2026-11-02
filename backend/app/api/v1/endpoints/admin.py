from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.user import User
from app.models.provider import Provider
from app.models.service import Service
from app.models.category import Category
from app.models.provider_service import ProviderService
from app.models.booking import Booking
from app.models.review import Review
from app.models.enums import BookingStatus, ServiceApprovalStatus, UserRole, NotificationType
from app.models.email_notification import EmailNotification
from app.models.provider_document import ProviderDocument
from app.models.provider_verification import ProviderVerification
from app.api.deps import require_admin
from app.services.email_service import EmailService
from app.services.order_service import refresh_order_status
from app.core.config import settings
from app.services.notification_service import NotificationService

router = APIRouter(dependencies=[Depends(require_admin)])


class RejectServiceRequest(BaseModel):
    reason: Optional[str] = "Service does not meet marketplace standards or documentation requirements."


class UserStatusUpdate(BaseModel):
    is_active: bool


class ProviderVerificationUpdate(BaseModel):
    is_verified: bool


class ProviderReviewRequest(BaseModel):
    status: Literal["APPROVED", "REJECTED", "SUSPENDED"]
    reason: Optional[str] = Field(default=None, max_length=1000)


class CancelBookingRequest(BaseModel):
    reason: Optional[str] = "Cancelled by marketplace administrator."


# ========================================================
# 1. ANALYTICS & MARKETPLACE STATS
# ========================================================

@router.get("/stats")
@router.get("/analytics")
def get_admin_dashboard_analytics(db: Session = Depends(get_db)):
    """
    Comprehensive AI & Marketplace Analytics for Admin Dashboard:
    - User / Provider / Service counts
    - Pending vs Approved Services
    - Booking statuses & breakdown
    - Most requested services
    - Top performing providers
    """
    total_users = db.query(User).filter(User.role == UserRole.USER).count()
    total_providers = db.query(Provider).count()
    total_services = db.query(Service).count()
    
    # Provider Services Breakdown
    pending_services = db.query(ProviderService).filter(ProviderService.status == ServiceApprovalStatus.PENDING).count()
    approved_services = db.query(ProviderService).filter(ProviderService.status == ServiceApprovalStatus.APPROVED).count()
    rejected_services = db.query(ProviderService).filter(ProviderService.status == ServiceApprovalStatus.REJECTED).count()

    total_bookings = db.query(Booking).count()
    completed_bookings = db.query(Booking).filter(Booking.status == BookingStatus.COMPLETED).count()
    cancelled_bookings = db.query(Booking).filter(Booking.status.in_([BookingStatus.CANCELLED, BookingStatus.REJECTED])).count()
    pending_bookings = db.query(Booking).filter(Booking.status == BookingStatus.PENDING).count()
    accepted_bookings = db.query(Booking).filter(Booking.status == BookingStatus.ACCEPTED).count()

    # Most requested services
    top_services_raw = (
        db.query(Service.name, func.count(Booking.id).label("booking_count"))
        .join(Booking, Booking.service_id == Service.id)
        .group_by(Service.name)
        .order_by(func.count(Booking.id).desc())
        .limit(5)
        .all()
    )
    most_requested = [{"service": name, "bookings": count} for name, count in top_services_raw]

    # Top performing providers
    top_providers_raw = (
        db.query(Provider)
        .order_by(Provider.rating_avg.desc(), Provider.total_ratings.desc())
        .limit(5)
        .all()
    )
    top_providers = [
        {
            "id": p.id,
            "business_name": p.business_name or (p.user.full_name if p.user else "Provider"),
            "rating": p.rating_avg,
            "total_ratings": p.total_ratings,
            "is_verified": p.is_verified
        }
        for p in top_providers_raw
    ]

    total_reviews = db.query(Review).count()
    total_notifications = db.query(EmailNotification).count()

    return {
        "total_users": total_users,
        "total_providers": total_providers,
        "total_categories": db.query(Category).count(),
        "total_services": total_services,
        "pending_services": pending_services,
        "approved_services": approved_services,
        "rejected_services": rejected_services,
        "total_bookings": total_bookings,
        "completed_bookings": completed_bookings,
        "cancelled_bookings": cancelled_bookings,
        "pending_bookings": pending_bookings,
        "accepted_bookings": accepted_bookings,
        "total_reviews": total_reviews,
        "total_notifications": total_notifications,
        "most_requested_services": most_requested,
        "top_providers": top_providers
    }


# ========================================================
# 2. SERVICE MANAGEMENT (APPROVAL / REJECTION)
# ========================================================

@router.get("/services")
def list_provider_submitted_services(
    status_filter: Optional[str] = Query(None, description="Filter by: PENDING, APPROVED, REJECTED, INACTIVE"),
    db: Session = Depends(get_db)
):
    """View all provider-submitted services across the marketplace with approval statuses."""
    q = db.query(ProviderService)
    if status_filter and status_filter.upper() != "ALL":
        try:
            enum_val = ServiceApprovalStatus(status_filter.upper())
            q = q.filter(ProviderService.status == enum_val)
        except ValueError:
            pass

    services = q.order_by(ProviderService.created_at.desc()).all()
    results = []

    for ps in services:
        provider = ps.provider
        user = provider.user if provider else None
        service = ps.service
        category = ps.category or (service.category if service else None)

        results.append({
            "id": ps.id,
            "provider_id": ps.provider_id,
            "provider_name": user.full_name if user else "Provider",
            "provider_business": provider.business_name if provider else "Specialist",
            "provider_email": user.email if user else None,
            "service_id": ps.service_id,
            "service_name": ps.custom_service_name or (service.name if service else "Service"),
            "category_name": category.name if category else "General",
            "price": ps.custom_price,
            "description": ps.description or (service.description if service else ""),
            "experience": ps.experience or (f"{provider.experience_years} years" if provider else ""),
            "service_location": ps.service_location or (provider.address if provider else ""),
            "service_radius_km": ps.service_radius_km,
            "availability": ps.availability_hours,
            "status": ps.status.value,
            "is_active": ps.is_active,
            "rejection_reason": ps.rejection_reason,
            "image_url": ps.image_url,
            "created_at": ps.created_at.isoformat()
        })

    return results


@router.post("/services/{provider_service_id}/approve")
def approve_provider_service(
    provider_service_id: int,
    db: Session = Depends(get_db)
):
    """Admin approves a provider-submitted service. Becomes visible in marketplace Discover and Services."""
    ps = db.query(ProviderService).filter(ProviderService.id == provider_service_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Provider service not found")

    ps.status = ServiceApprovalStatus.APPROVED
    ps.is_active = True
    ps.rejection_reason = None
    db.commit()
    db.refresh(ps)

    svc_name = ps.custom_service_name or (ps.service.name if ps.service else "Service")
    return {
        "id": ps.id,
        "status": ps.status.value,
        "message": f"Service '{svc_name}' has been APPROVED and is now live in the marketplace."
    }


@router.post("/services/{provider_service_id}/reject")
def reject_provider_service(
    provider_service_id: int,
    payload: RejectServiceRequest,
    db: Session = Depends(get_db)
):
    """Admin rejects a provider-submitted service with reason."""
    ps = db.query(ProviderService).filter(ProviderService.id == provider_service_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Provider service not found")

    ps.status = ServiceApprovalStatus.REJECTED
    ps.rejection_reason = payload.reason
    db.commit()
    db.refresh(ps)

    svc_name = ps.custom_service_name or (ps.service.name if ps.service else "Service")
    return {
        "id": ps.id,
        "status": ps.status.value,
        "message": f"Service '{svc_name}' was REJECTED: {payload.reason}"
    }


@router.patch("/services/{provider_service_id}/toggle-active")
def toggle_service_active_admin(
    provider_service_id: int,
    db: Session = Depends(get_db)
):
    """Admin activates or deactivates any service in the marketplace."""
    ps = db.query(ProviderService).filter(ProviderService.id == provider_service_id).first()
    if not ps:
        raise HTTPException(status_code=404, detail="Provider service not found")

    ps.is_active = not ps.is_active
    db.commit()
    db.refresh(ps)

    return {
        "id": ps.id,
        "is_active": ps.is_active,
        "status": ps.status.value,
        "message": f"Service is now {'ACTIVE' if ps.is_active else 'INACTIVE'}."
    }


# ========================================================
# 3. USER MANAGEMENT
# ========================================================

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    """View all registered users with account details and roles."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    results = []
    for u in users:
        booking_count = db.query(Booking).filter(Booking.user_id == u.id).count()
        results.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "role": u.role.value,
            "is_active": u.is_active,
            "total_bookings": booking_count,
            "created_at": u.created_at.isoformat()
        })
    return results


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    db: Session = Depends(get_db)
):
    """Admin activates or deactivates a user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot deactivate system administrator.")

    user.is_active = status_in.is_active
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "is_active": user.is_active,
        "message": f"User account {'ACTIVATED' if user.is_active else 'DEACTIVATED'} successfully."
    }


# ========================================================
# 4. PROVIDER MANAGEMENT
# ========================================================

@router.get("/providers")
def list_all_providers_admin(db: Session = Depends(get_db)):
    """View all registered providers with verification status and published services count."""
    providers = db.query(Provider).order_by(Provider.created_at.desc()).all()
    results = []
    for p in providers:
        user = p.user
        svc_count = db.query(ProviderService).filter(ProviderService.provider_id == p.id).count()
        approved_svc_count = db.query(ProviderService).filter(
            ProviderService.provider_id == p.id,
            ProviderService.status == ServiceApprovalStatus.APPROVED
        ).count()
        booking_count = db.query(Booking).filter(Booking.provider_id == p.id).count()

        results.append({
            "id": p.id,
            "user_id": p.user_id,
            "name": user.full_name if user else "Provider",
            "email": user.email if user else None,
            "phone": user.phone if user else None,
            "business_name": p.business_name or (user.full_name if user else "Specialist"),
            "experience_years": p.experience_years,
            "address": p.address,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "is_verified": p.is_verified,
            "verification_status": p.verification_status,
            "is_available": p.is_available,
            "rating_avg": p.rating_avg,
            "total_ratings": p.total_ratings,
            "total_services": svc_count,
            "approved_services": approved_svc_count,
            "total_bookings": booking_count,
            "services": [
                {
                    "service_id": item.service_id,
                    "name": item.custom_service_name or (item.service.name if item.service else "Service"),
                    "price": item.custom_price,
                    "status": item.status.value,
                    "location": item.service_location,
                    "service_radius_km": item.service_radius_km,
                }
                for item in p.provider_services
            ],
            "created_at": p.created_at.isoformat()
        })
    return results


@router.get("/provider-verifications")
def list_provider_verifications(
    status_filter: str = Query("PENDING", alias="status", pattern="^(PENDING|APPROVED|REJECTED|SUSPENDED|ALL)$"),
    db: Session = Depends(get_db),
):
    query = db.query(Provider)
    if status_filter != "ALL":
        query = query.filter(Provider.verification_status == status_filter)
    providers = query.order_by(Provider.created_at.desc()).all()
    result = []
    for provider in providers:
        user = provider.user
        documents = db.query(ProviderDocument).filter(
            ProviderDocument.provider_id == provider.id
        ).order_by(ProviderDocument.created_at.desc()).all()
        result.append({
            "id": provider.id,
            "name": user.full_name if user else "Provider",
            "email": user.email if user else None,
            "email_verified": bool(user and user.email_verified_at),
            "phone": user.phone if user else None,
            "business_name": provider.business_name or (user.full_name if user else "Provider"),
            "experience_years": provider.experience_years,
            "qualifications": provider.qualifications,
            "address": provider.address,
            "latitude": provider.latitude,
            "longitude": provider.longitude,
            "service_radius_km": provider.service_radius_km,
            "status": provider.verification_status,
            "is_available": provider.is_available,
            "registration_date": provider.created_at.isoformat(),
            "services": [
                {
                    "id": offering.id,
                    "service_id": offering.service_id,
                    "name": offering.custom_service_name or (offering.service.name if offering.service else "Service"),
                    "price": offering.custom_price,
                    "description": offering.description,
                    "location": offering.service_location,
                    "latitude": offering.service_latitude,
                    "longitude": offering.service_longitude,
                    "radius_km": offering.service_radius_km,
                    "availability": offering.availability_hours,
                    "status": offering.status.value,
                }
                for offering in provider.provider_services
            ],
            "documents": [
                {
                    "id": document.id,
                    "document_type": document.document_type,
                    "filename": document.original_filename,
                    "content_type": document.content_type,
                    "created_at": document.created_at.isoformat(),
                }
                for document in documents
            ],
            "review_history": [
                {
                    "status": review.status,
                    "reviewer": review.reviewer.full_name if review.reviewer else "Administrator",
                    "reason": review.reason,
                    "reviewed_at": review.created_at.isoformat(),
                }
                for review in provider.verification_history
            ],
        })
    return result


@router.post("/providers/{provider_id}/verification")
def review_provider(
    provider_id: int,
    review_in: ProviderReviewRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")
    reason = review_in.reason.strip() if review_in.reason else None
    if review_in.status in {"REJECTED", "SUSPENDED"} and (not reason or len(reason) < 3):
        raise HTTPException(status_code=422, detail="A rejection or suspension reason is required.")
    if review_in.status == "APPROVED":
        document_types = {
            row[0] for row in db.query(ProviderDocument.document_type).filter(
                ProviderDocument.provider_id == provider.id
            ).all()
        }
        required_documents = {"IDENTITY", "SERVICE_QUALIFICATION"}
        if not provider.user or not provider.user.email_verified_at:
            raise HTTPException(status_code=409, detail="The provider email must be verified before approval.")
        if not required_documents.issubset(document_types):
            raise HTTPException(status_code=409, detail="Identity and service qualification documents are required.")
        if not provider.provider_services:
            raise HTTPException(status_code=409, detail="The provider must submit at least one service.")
        if any(
            offering.service_latitude is None
            or offering.service_longitude is None
            or not offering.service_location
            for offering in provider.provider_services
        ):
            raise HTTPException(status_code=409, detail="Every submitted service must include an address and map location.")
        for offering in provider.provider_services:
            if offering.status == ServiceApprovalStatus.PENDING:
                offering.status = ServiceApprovalStatus.APPROVED
                offering.is_active = True
                offering.rejection_reason = None

    provider.verification_status = review_in.status
    provider.is_verified = review_in.status == "APPROVED"
    provider.is_available = review_in.status == "APPROVED"
    verification_record = ProviderVerification(
        provider_id=provider.id,
        status=review_in.status,
        reviewer_id=current_admin.id,
        reason=reason,
    )
    db.add(verification_record)
    if provider.user:
        db.flush()
        NotificationService.provider_reviewed(
            db,
            provider.user,
            provider.id,
            verification_record.id,
            review_in.status,
            reason,
        )
    db.commit()
    return {
        "id": provider.id,
        "status": provider.verification_status,
        "is_available": provider.is_available,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/provider-documents/{document_id}/download")
def download_provider_document(
    document_id: int,
    db: Session = Depends(get_db),
):
    document = db.query(ProviderDocument).filter(ProviderDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Provider document not found.")
    storage_dir = Path(settings.PRIVATE_UPLOAD_DIR).resolve()
    path = (storage_dir / document.storage_name).resolve()
    if path.parent != storage_dir or not path.is_file():
        raise HTTPException(status_code=404, detail="Provider document is not available.")
    return FileResponse(path, media_type=document.content_type, filename=document.original_filename)


@router.patch("/providers/{provider_id}/verify")
def toggle_provider_verification(
    provider_id: int,
    verify_in: ProviderVerificationUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin grants or revokes verified badge for provider."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if verify_in.is_verified:
        return review_provider(
            provider_id,
            ProviderReviewRequest(status="APPROVED"),
            current_admin=current_admin,
            db=db,
        )
    provider.is_verified = False
    provider.verification_status = "PENDING"
    provider.is_available = False
    db.add(ProviderVerification(
        provider_id=provider.id,
        status="PENDING",
        reviewer_id=current_admin.id,
        reason="Verification revoked by administrator.",
    ))
    db.commit()
    db.refresh(provider)
    return {
        "id": provider.id,
        "is_verified": provider.is_verified,
        "message": f"Provider verification updated to {provider.is_verified}."
    }


@router.patch("/providers/{provider_id}/status")
def toggle_provider_availability_admin(
    provider_id: int,
    db: Session = Depends(get_db)
):
    """Admin toggles provider availability in the marketplace."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if provider.verification_status != "APPROVED" and not provider.is_available:
        raise HTTPException(status_code=403, detail="Only approved providers can be made available.")
    provider.is_available = not provider.is_available
    db.commit()
    db.refresh(provider)
    return {
        "id": provider.id,
        "is_available": provider.is_available,
        "message": f"Provider availability set to {provider.is_available}."
    }


# ========================================================
# 5. BOOKING MANAGEMENT
# ========================================================

@router.get("/bookings")
def list_all_bookings_admin(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """View all customer bookings in marketplace."""
    q = db.query(Booking)
    if status_filter and status_filter.upper() != "ALL":
        try:
            enum_val = BookingStatus(status_filter.upper())
            q = q.filter(Booking.status == enum_val)
        except ValueError:
            pass

    bookings = q.order_by(Booking.created_at.desc()).limit(100).all()
    results = []
    for b in bookings:
        customer = b.user
        provider = b.provider
        service = b.service
        results.append({
            "id": b.id,
            "reference": b.booking_reference,
            "customer_name": customer.full_name if customer else "Customer",
            "customer_email": customer.email if customer else None,
            "provider_business": provider.business_name if provider else "Specialist",
            "service_name": service.name if service else "Service",
            "date": b.booking_date,
            "time": b.booking_time,
            "address": b.service_address,
            "amount": b.total_amount,
            "status": b.status.value,
            "created_at": b.created_at.isoformat()
        })
    return results


@router.patch("/bookings/{booking_id}/cancel")
def admin_cancel_booking(
    booking_id: int,
    payload: CancelBookingRequest,
    db: Session = Depends(get_db)
):
    """Admin cancels a booking and notifies the customer via email."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == BookingStatus.CANCELLED:
        return {
            "id": booking.id,
            "reference": booking.booking_reference,
            "status": booking.status.value,
            "email_notified": False,
            "email_status": "ALREADY_CANCELLED",
            "message": "Booking was already cancelled.",
        }

    booking.status = BookingStatus.CANCELLED
    refresh_order_status(db, booking.order_id)
    notification = EmailService.enqueue_booking_status_email(
        db=db,
        booking=booking,
        notification_type=NotificationType.BOOKING_CANCELLED,
        reason=payload.reason,
    )
    db.commit()
    db.refresh(booking)
    email_status = EmailService.deliver_outbox_event(db, notification.id)

    return {
        "id": booking.id,
        "reference": booking.booking_reference,
        "status": booking.status.value,
        "email_notified": email_status in {"SENT", "MOCK_SENT"},
        "email_status": email_status,
        "message": "Booking cancellation was saved; customer notification was queued."
    }


# ========================================================
# 6. REVIEW MANAGEMENT
# ========================================================

@router.get("/reviews")
def list_all_reviews_admin(db: Session = Depends(get_db)):
    """View all reviews for moderation."""
    reviews = db.query(Review).order_by(Review.created_at.desc()).limit(100).all()
    results = []
    for r in reviews:
        user = r.user
        provider = r.provider
        results.append({
            "id": r.id,
            "user_name": user.full_name if user else "Customer",
            "provider_name": provider.business_name if provider else "Provider",
            "review_text": r.review_text,
            "sentiment": r.sentiment or "NEUTRAL",
            "sentiment_score": r.sentiment_score or 0.8,
            "created_at": r.created_at.isoformat()
        })
    return results


@router.delete("/reviews/{review_id}")
def delete_inappropriate_review(
    review_id: int,
    db: Session = Depends(get_db)
):
    """Admin removes an inappropriate review."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    db.delete(review)
    db.commit()
    return {"message": "Review deleted successfully"}
