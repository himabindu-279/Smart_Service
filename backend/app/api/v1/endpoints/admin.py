from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
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
from app.api.deps import require_admin
from app.services.email_service import EmailService

router = APIRouter(dependencies=[Depends(require_admin)])


class RejectServiceRequest(BaseModel):
    reason: Optional[str] = "Service does not meet marketplace standards or documentation requirements."


class UserStatusUpdate(BaseModel):
    is_active: bool


class ProviderVerificationUpdate(BaseModel):
    is_verified: bool


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
            "is_available": p.is_available,
            "rating_avg": p.rating_avg,
            "total_ratings": p.total_ratings,
            "total_services": svc_count,
            "approved_services": approved_svc_count,
            "total_bookings": booking_count,
            "created_at": p.created_at.isoformat()
        })
    return results


@router.patch("/providers/{provider_id}/verify")
def toggle_provider_verification(
    provider_id: int,
    verify_in: ProviderVerificationUpdate,
    db: Session = Depends(get_db)
):
    """Admin grants or revokes verified badge for provider."""
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    provider.is_verified = verify_in.is_verified
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

    booking.status = BookingStatus.CANCELLED
    db.commit()
    db.refresh(booking)

    # Automated cancellation email
    notification = EmailService.send_booking_email(
        db=db,
        booking=booking,
        notification_type=NotificationType.BOOKING_CANCELLED
    )

    return {
        "id": booking.id,
        "reference": booking.booking_reference,
        "status": booking.status.value,
        "email_notified": True,
        "email_status": notification.sent_status,
        "message": "Booking cancelled by admin and cancellation email sent to customer."
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
