import hashlib
import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.booking import Booking
from app.models.booking_email_outbox import BookingEmailOutbox
from app.models.email_notification import EmailNotification
from app.models.enums import NotificationType

logger = logging.getLogger("uvicorn.error")


def _send_smtp_message(recipient: str, subject: str, body: str, message_id: Optional[str] = None) -> None:
    if not (settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD):
        raise RuntimeError("SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD must be configured.")

    message = MIMEMultipart()
    message["From"] = settings.SMTP_FROM
    message["To"] = recipient
    message["Subject"] = subject
    if message_id:
        message["Message-ID"] = f"<{message_id}@smartservice.local>"
    message.attach(MIMEText(body, "plain", "utf-8"))

    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
        return

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        server.ehlo()
        if settings.SMTP_USE_TLS:
            server.starttls()
            server.ehlo()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)


class EmailService:
    @staticmethod
    def send_verification_code(recipient: str, code: str) -> None:
        _send_smtp_message(
            recipient,
            "Verify your Smart Service provider email",
            f"Your email verification code is {code}. It expires in 15 minutes.",
        )

    @staticmethod
    def enqueue_booking_status_email(
        db: Session,
        booking: Booking,
        notification_type: NotificationType,
        reason: Optional[str] = None,
    ) -> BookingEmailOutbox:
        event_key = f"booking:{booking.id}:{notification_type.value}"
        existing = db.query(BookingEmailOutbox).filter(
            BookingEmailOutbox.event_key == event_key
        ).first()
        if existing:
            return existing

        customer = booking.user
        if not customer or not customer.email:
            raise ValueError("A registered customer email is required for booking notifications.")
        provider_name = (
            booking.provider.business_name
            if booking.provider and booking.provider.business_name
            else (booking.provider.user.full_name if booking.provider and booking.provider.user else "Provider")
        )
        service_name = booking.service.name if booking.service else "Service"
        status_label = booking.status.value
        if notification_type == NotificationType.BOOKING_CONFIRMED:
            subject = "Your service booking was accepted"
            intro = "Your provider accepted the service booking."
        elif notification_type == NotificationType.BOOKING_REJECTED:
            subject = "Your service booking was rejected"
            intro = "Your provider could not accept the service booking."
        else:
            subject = "Your service booking was cancelled"
            intro = "Your service booking was cancelled."

        message = (
            f"Hello {customer.full_name},\n\n{intro}\n\n"
            f"Customer: {customer.full_name}\n"
            f"Service: {service_name}\n"
            f"Provider: {provider_name}\n"
            f"Date: {booking.booking_date}\n"
            f"Time: {booking.booking_time}\n"
            f"Location: {booking.service_address}\n"
            f"Reference: {booking.booking_reference}\n"
            f"Status: {status_label}\n"
        )
        if reason:
            message += f"Reason: {reason.strip()}\n"
        message += "\nSmart Service Marketplace"

        outbox = BookingEmailOutbox(
            booking_id=booking.id,
            event_key=event_key,
            recipient_email=customer.email,
            subject=subject,
            body=message,
            status="PENDING",
        )
        db.add(outbox)
        db.flush()
        return outbox

    @staticmethod
    def deliver_outbox_event(db: Session, outbox_id: int) -> str:
        now = datetime.now(timezone.utc)
        event = (
            db.query(BookingEmailOutbox)
            .filter(BookingEmailOutbox.id == outbox_id)
            .with_for_update()
            .first()
        )
        if not event:
            return "NOT_FOUND"
        if event.status in {"SENT", "MOCK_SENT"}:
            return event.status
        available_at = event.available_at
        if available_at.tzinfo is None:
            available_at = available_at.replace(tzinfo=timezone.utc)
        if event.status == "SENDING" and available_at > now:
            return "SENDING"
        if event.status in {"PENDING", "FAILED"} and available_at > now:
            return event.status

        event.status = "SENDING"
        event.attempts += 1
        event.available_at = now + timedelta(minutes=5)
        db.commit()

        notification_type = NotificationType(event.event_key.rsplit(":", 1)[-1])
        try:
            if not (settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD):
                if settings.ENVIRONMENT.lower() == "production":
                    raise RuntimeError("Booking email delivery requires SMTP configuration.")
                delivery_status = "MOCK_SENT"
                logger.info("Local booking email simulation for event %s to %s", event.event_key, event.recipient_email)
            else:
                message_id = hashlib.sha256(event.event_key.encode()).hexdigest()
                _send_smtp_message(event.recipient_email, event.subject, event.body, message_id)
                delivery_status = "SENT"
        except (OSError, RuntimeError, smtplib.SMTPException) as exc:
            event.status = "FAILED"
            event.last_error = str(exc)[:2000]
            retry_minutes = min(60, 2 ** min(event.attempts, 6))
            event.available_at = datetime.now(timezone.utc) + timedelta(minutes=retry_minutes)
            db.commit()
            logger.error("Booking email delivery failed for event %s: %s", event.event_key, exc)
            return "FAILED"

        event.status = delivery_status
        event.last_error = None
        event.sent_at = datetime.now(timezone.utc)
        if not db.query(EmailNotification).filter(
            EmailNotification.booking_id == event.booking_id,
            EmailNotification.notification_type == notification_type,
        ).first():
            db.add(EmailNotification(
                booking_id=event.booking_id,
                recipient_email=event.recipient_email,
                notification_type=notification_type,
                subject=event.subject,
                body=event.body,
                sent_status=delivery_status,
            ))
        db.commit()
        return delivery_status


def process_due_booking_emails() -> None:
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        events = (
            db.query(BookingEmailOutbox.id)
            .filter(
                BookingEmailOutbox.status.in_(["PENDING", "FAILED", "SENDING"]),
                BookingEmailOutbox.available_at <= now,
            )
            .order_by(BookingEmailOutbox.available_at.asc())
            .limit(25)
            .all()
        )
        for (event_id,) in events:
            EmailService.deliver_outbox_event(db, event_id)
    finally:
        db.close()
