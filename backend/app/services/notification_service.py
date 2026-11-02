import logging
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

import httpx
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.enums import BookingStatus, UserRole
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger("uvicorn.error")
SMS_MAX_ATTEMPTS = 5


class NotificationService:
    @staticmethod
    def enqueue(
        db: Session,
        *,
        event_key: str,
        event_type: str,
        title: str,
        body: str,
        recipients: Iterable[User],
        booking_id: Optional[int] = None,
    ) -> None:
        for recipient in recipients:
            if not recipient or not recipient.id:
                continue
            NotificationService._add_record(
                db,
                event_key=f"{event_key}:{recipient.id}:IN_APP",
                event_type=event_type,
                channel="IN_APP",
                recipient=str(recipient.id),
                user_id=recipient.id,
                booking_id=booking_id,
                title=title,
                body=body,
                status="UNREAD",
            )
            if recipient.phone:
                NotificationService._add_record(
                    db,
                    event_key=f"{event_key}:{recipient.id}:SMS",
                    event_type=event_type,
                    channel="SMS",
                    recipient=recipient.phone,
                    user_id=recipient.id,
                    booking_id=booking_id,
                    title=title,
                    body=body,
                    status="PENDING",
                    available_at=datetime.now(timezone.utc),
                )

    @staticmethod
    def _add_record(db: Session, **values) -> None:
        existing = db.query(Notification.id).filter(
            Notification.event_key == values["event_key"]
        ).first()
        if not existing:
            db.add(Notification(**values))

    @staticmethod
    def booking_created(db: Session, booking: Booking) -> None:
        admins = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active.is_(True)).all()
        provider_user = booking.provider.user if booking.provider else None
        recipients = [booking.user, provider_user, *admins]
        service_name = booking.service.name if booking.service else "Service"
        provider_name = (
            booking.provider.business_name
            if booking.provider and booking.provider.business_name
            else (provider_user.full_name if provider_user else "Provider")
        )
        NotificationService.enqueue(
            db,
            event_key=f"booking:{booking.id}:submitted",
            event_type="BOOKING_SUBMITTED",
            title="Booking request submitted",
            body=(
                f"{service_name} with {provider_name} on "
                f"{booking.booking_date} at {booking.booking_time}. "
                f"Reference: {booking.booking_reference}."
            ),
            recipients=recipients,
            booking_id=booking.id,
        )

    @staticmethod
    def booking_status_changed(
        db: Session,
        booking: Booking,
        new_status: BookingStatus,
        reason: Optional[str] = None,
    ) -> None:
        provider_user = booking.provider.user if booking.provider else None
        recipients = [booking.user]
        if new_status == BookingStatus.CANCELLED:
            recipients.append(provider_user)
        provider_name = (
            booking.provider.business_name
            if booking.provider and booking.provider.business_name
            else (provider_user.full_name if provider_user else "Provider")
        )
        service_name = booking.service.name if booking.service else "Service"
        body = (
            f"{service_name} with {provider_name} is now {new_status.value.lower()}. "
            f"Reference: {booking.booking_reference}."
        )
        if reason:
            body = f"{body} Reason: {reason}"
        NotificationService.enqueue(
            db,
            event_key=f"booking:{booking.id}:{new_status.value.lower()}",
            event_type=f"BOOKING_{new_status.value}",
            title=f"Booking {new_status.value.lower()}",
            body=body,
            recipients=recipients,
            booking_id=booking.id,
        )

    @staticmethod
    def provider_registered(db: Session, provider_user: User, business_name: str) -> None:
        admins = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active.is_(True)).all()
        NotificationService.enqueue(
            db,
            event_key=f"provider:{provider_user.id}:registered",
            event_type="PROVIDER_REGISTRATION",
            title="Provider application received",
            body=f"{business_name} registered and is waiting for verification review.",
            recipients=admins,
        )

    @staticmethod
    def provider_reviewed(
        db: Session,
        provider_user: User,
        provider_id: int,
        review_id: int,
        status: str,
        reason: Optional[str],
    ) -> None:
        body = f"Your provider application was {status.lower()}."
        if reason:
            body = f"{body} Reason: {reason}"
        NotificationService.enqueue(
            db,
            event_key=f"provider:{provider_id}:review:{review_id}",
            event_type=f"PROVIDER_{status}",
            title=f"Provider application {status.lower()}",
            body=body,
            recipients=[provider_user],
        )


def _send_twilio_sms(notification: Notification) -> None:
    if not (
        settings.SMS_PROVIDER.lower() == "twilio"
        and settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_FROM_NUMBER
    ):
        raise RuntimeError("SMS delivery is not configured. Set SMS_PROVIDER=twilio and the Twilio credentials.")
    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/"
        f"{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    )
    response = httpx.post(
        url,
        auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
        data={"To": notification.recipient, "From": settings.TWILIO_FROM_NUMBER, "Body": notification.body},
        headers={"I-Twilio-Idempotency-Token": notification.event_key},
        timeout=15,
    )
    response.raise_for_status()


def process_due_sms_notifications(limit: int = 20) -> int:
    if not (
        settings.SMS_PROVIDER.lower() == "twilio"
        and settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_FROM_NUMBER
    ):
        return 0

    db = SessionLocal()
    processed = 0
    try:
        now = datetime.now(timezone.utc)
        db.query(Notification).filter(
            Notification.channel == "SMS",
            Notification.status == "SENDING",
            Notification.available_at <= now,
        ).update({"status": "PENDING", "available_at": now}, synchronize_session=False)
        db.commit()
        query = db.query(Notification).filter(
            Notification.channel == "SMS",
            Notification.status == "PENDING",
            Notification.available_at <= now,
        ).order_by(Notification.created_at.asc()).limit(limit)
        if db.bind and db.bind.dialect.name == "postgresql":
            query = query.with_for_update(skip_locked=True)
        pending = query.all()
        for notification in pending:
            notification.status = "SENDING"
            notification.attempts += 1
            notification.available_at = now + timedelta(minutes=5)
        db.commit()
        for notification in pending:
            try:
                _send_twilio_sms(notification)
                notification.status = "SENT"
                notification.delivered_at = datetime.now(timezone.utc)
                notification.last_error = None
            except (httpx.HTTPError, RuntimeError) as exc:
                notification.last_error = str(exc)[:2000]
                if notification.attempts >= SMS_MAX_ATTEMPTS:
                    notification.status = "FAILED"
                else:
                    notification.status = "PENDING"
                    notification.available_at = datetime.now(timezone.utc) + timedelta(
                        seconds=min(3600, 30 * (2 ** (notification.attempts - 1)))
                    )
                logger.warning("SMS notification %s delivery failed: %s", notification.id, exc)
            db.commit()
            processed += 1
    except SQLAlchemyError:
        db.rollback()
        logger.exception("SMS notification queue processing failed.")
        raise
    finally:
        db.close()
    return processed
