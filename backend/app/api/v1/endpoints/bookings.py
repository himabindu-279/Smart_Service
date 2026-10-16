import uuid
import logging
from datetime import datetime, time, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.booking import Booking
from app.models.enums import BookingStatus, UserRole, NotificationType, ServiceApprovalStatus
from app.models.provider import Provider
from app.models.provider_service import ProviderService
from app.models.provider_availability import ProviderAvailability
from app.models.service import Service
from app.models.user import User
from app.models.email_notification import EmailNotification
from app.schemas.booking import BookingCreate, BookingUpdateStatus
from app.api.deps import get_current_active_user, require_admin
from app.services.email_service import EmailService

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


def _booking_response(booking: Booking, email_status: str = "NOT_SENT"):
    return {
        "id": booking.id,
        "booking_reference": booking.booking_reference,
        "status": booking.status.value,
        "service_name": booking.service.name,
        "provider_name": booking.provider.business_name or "Service Specialist",
        "booking_date": booking.booking_date,
        "booking_time": booking.booking_time,
        "total_amount": booking.total_amount,
        "created_at": booking.created_at.isoformat(),
        "email_notified": email_status in ("SENT", "MOCK_SENT"),
        "email_status": email_status
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_booking(
    booking_in: BookingCreate,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new service booking with double-booking prevention and provider availability check."""
    provider = db.query(Provider).filter(Provider.id == booking_in.provider_id).with_for_update().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if not provider.is_available:
        raise HTTPException(
            status_code=400,
            detail="The selected provider is currently not available for bookings."
        )

    service = db.query(Service).filter(
        Service.id == booking_in.service_id,
        Service.is_active == True
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Check provider service approval
    ps = db.query(ProviderService).filter(
        ProviderService.provider_id == provider.id,
        ProviderService.service_id == service.id,
        ProviderService.is_active == True,
        ProviderService.status == ServiceApprovalStatus.APPROVED
    ).first()

    if not ps:
        raise HTTPException(
            status_code=400,
            detail="This provider does not offer the selected service. Please choose another provider."
        )

    if current_user.email.casefold() != str(booking_in.customer_email).casefold():
        raise HTTPException(status_code=400, detail="Contact email must match the signed-in account.")

    requested_date = booking_in.booking_date.isoformat()
    requested_time = booking_in.booking_time.isoformat(timespec="minutes")

    # Return an earlier identical request so a network retry cannot create another row.
    duplicate = db.query(Booking).filter(
        Booking.user_id == current_user.id,
        Booking.provider_id == provider.id,
        Booking.service_id == service.id,
        Booking.booking_date == requested_date,
        Booking.booking_time == requested_time,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS])
    ).first()
    if duplicate:
        response.status_code = status.HTTP_200_OK
        return _booking_response(duplicate, "ALREADY_RECORDED")

    # Enforce configured weekly hours. With no configured schedule, the request remains pending.
    availability_rules = db.query(ProviderAvailability).filter(
        ProviderAvailability.provider_id == provider.id
    ).all()
    if availability_rules:
        day_rules = [rule for rule in availability_rules if rule.day_of_week == booking_in.booking_date.weekday() and rule.is_available]
        requested_start = datetime.combine(booking_in.booking_date, booking_in.booking_time)
        fits_schedule = False
        for rule in day_rules:
            try:
                start = time.fromisoformat(rule.start_time)
                end = time.fromisoformat(rule.end_time)
            except ValueError:
                continue
            requested_end = requested_start + timedelta(minutes=service.estimated_duration_minutes)
            if requested_start.time() >= start and requested_end.time() <= end:
                fits_schedule = True
                break
        if not fits_schedule:
            raise HTTPException(status_code=400, detail="The provider has no configured availability for that date and time.")

    # Prevent overlapping requests for the selected provider.
    existing = db.query(Booking).filter(
        Booking.provider_id == booking_in.provider_id,
        Booking.booking_date == requested_date,
        Booking.booking_time == requested_time,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS])
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="The selected provider is already booked for this date and time slot. Please choose another slot."
        )

    total_amount = ps.custom_price if ps.custom_price is not None else service.base_price
    booking_ref = f"BK-{uuid.uuid4().hex[:8].upper()}"

    booking = Booking(
        booking_reference=booking_ref,
        user_id=current_user.id,
        provider_id=provider.id,
        service_id=service.id,
        provider_service_id=ps.id if ps else None,
        booking_date=requested_date,
        booking_time=requested_time,
        status=BookingStatus.PENDING,
        total_amount=total_amount,
        service_address=booking_in.service_address,
        latitude=booking_in.latitude,
        longitude=booking_in.longitude,
        special_instructions=booking_in.special_instructions
    )
    current_user.full_name = booking_in.customer_full_name
    current_user.phone = booking_in.customer_mobile
    db.add(booking)
    try:
        db.commit()
        db.refresh(booking)
    except Exception:
        db.rollback()
        logger.exception("Booking persistence failed")
        raise HTTPException(status_code=500, detail="The booking could not be saved. Please retry.")

    email_status = "FAILED"
    try:
        email_notification = EmailService.send_booking_email(
            db=db, booking=booking, notification_type=NotificationType.BOOKING_CREATED
        )
        email_status = email_notification.sent_status
    except Exception:
        db.rollback()
        logger.warning("Booking saved, but its confirmation notification could not be recorded.")

    return _booking_response(booking, email_status)


@router.get("/my")
def get_my_bookings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retrieve all bookings requested by the current user."""
    bookings = (
        db.query(Booking)
        .filter(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )
    results = []
    for b in bookings:
        provider_name = b.provider.business_name if b.provider else "Provider"
        results.append({
            "id": b.id,
            "booking_reference": b.booking_reference,
            "provider_id": b.provider_id,
            "provider_name": provider_name,
            "service_id": b.service_id,
            "service_name": b.service.name if b.service else "Service",
            "booking_date": b.booking_date,
            "booking_time": b.booking_time,
            "status": b.status.value,
            "total_amount": b.total_amount,
            "service_address": b.service_address,
            "special_instructions": b.special_instructions,
            "has_review": b.review is not None,
            "created_at": b.created_at.isoformat()
        })
    return results


@router.get("/provider")
def get_provider_bookings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retrieve all bookings assigned to the authenticated provider."""
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=403, detail="You do not have a provider profile.")

    bookings = (
        db.query(Booking)
        .filter(Booking.provider_id == provider.id)
        .order_by(Booking.created_at.desc())
        .all()
    )
    results = []
    for b in bookings:
        results.append({
            "id": b.id,
            "booking_reference": b.booking_reference,
            "user_id": b.user_id,
            "user_name": b.user.full_name if b.user else "Customer",
            "user_email": b.user.email if b.user else None,
            "user_phone": b.user.phone if b.user else None,
            "service_id": b.service_id,
            "service_name": b.service.name if b.service else "Service",
            "booking_date": b.booking_date,
            "booking_time": b.booking_time,
            "status": b.status.value,
            "total_amount": b.total_amount,
            "service_address": b.service_address,
            "special_instructions": b.special_instructions,
            "created_at": b.created_at.isoformat()
        })
    return results


@router.patch("/{booking_id}/status")
def update_booking_status(
    booking_id: int,
    status_update: BookingUpdateStatus,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update status of a booking (Accept, Reject, In Progress, Complete, Cancel) with automated email notifications."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_owner = booking.user_id == current_user.id
    is_assigned_provider = (
        current_user.provider_profile and booking.provider_id == current_user.provider_profile.id
    )
    is_admin = current_user.role == UserRole.ADMIN

    if not (is_owner or is_assigned_provider or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to update this booking.")

    old_status = booking.status
    new_status = status_update.status
    booking.status = new_status
    db.commit()
    db.refresh(booking)

    # Automated real email notification events (Section 8 & 9)
    email_notification = None
    if new_status == BookingStatus.ACCEPTED and old_status != BookingStatus.ACCEPTED:
        email_notification = EmailService.send_booking_email(
            db=db, booking=booking, notification_type=NotificationType.BOOKING_CONFIRMED
        )
    elif new_status == BookingStatus.REJECTED and old_status != BookingStatus.REJECTED:
        email_notification = EmailService.send_booking_email(
            db=db, booking=booking, notification_type=NotificationType.BOOKING_REJECTED
        )
    elif new_status == BookingStatus.CANCELLED and old_status != BookingStatus.CANCELLED:
        email_notification = EmailService.send_booking_email(
            db=db, booking=booking, notification_type=NotificationType.BOOKING_CANCELLED
        )

    return {
        "id": booking.id,
        "booking_reference": booking.booking_reference,
        "status": booking.status.value,
        "message": f"Booking status updated to {booking.status.value}",
        "email_notified": email_notification is not None,
        "email_status": email_notification.sent_status if email_notification else None
    }


@router.get("/notifications")
def get_email_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """View sent email notifications related to user or all if admin."""
    if current_user.role == UserRole.ADMIN:
        notifications = (
            db.query(EmailNotification)
            .order_by(EmailNotification.created_at.desc())
            .limit(50)
            .all()
        )
    else:
        notifications = (
            db.query(EmailNotification)
            .filter(EmailNotification.recipient_email == current_user.email)
            .order_by(EmailNotification.created_at.desc())
            .limit(30)
            .all()
        )

    return [
        {
            "id": n.id,
            "booking_id": n.booking_id,
            "recipient": n.recipient_email,
            "type": n.notification_type.value,
            "subject": n.subject,
            "body": n.body,
            "sent_status": n.sent_status,
            "error_message": n.error_message,
            "created_at": n.created_at.isoformat()
        }
        for n in notifications
    ]


@router.get("/{booking_id}")
def get_booking(
    booking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_owner = booking.user_id == current_user.id
    is_assigned_provider = current_user.provider_profile and booking.provider_id == current_user.provider_profile.id
    is_admin = current_user.role == UserRole.ADMIN
    if not (is_owner or is_assigned_provider or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this booking.")

    return _booking_response(booking)
