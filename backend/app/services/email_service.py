import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.enums import NotificationType
from app.models.email_notification import EmailNotification
from app.models.booking import Booking

logger = logging.getLogger("uvicorn.error")


class EmailService:
    """
    Robust Email Notification Service.
    - Sends real emails via SMTP when configured.
    - Accurately logs and records email events into the email_notifications database table.
    - If SMTP credentials are not configured, records sent_status='MOCK_SENT' with log output.
    - If SMTP connection fails, records sent_status='FAILED' with exact error_message.
    """

    @classmethod
    def send_booking_email(
        cls,
        db: Session,
        booking: Booking,
        notification_type: NotificationType
    ) -> EmailNotification:
        customer = booking.user
        recipient_email = customer.email if customer else "customer@marketplace.com"
        customer_name = customer.full_name if customer else "Customer"
        provider_name = (
            booking.provider.business_name
            if booking.provider and booking.provider.business_name
            else "Verified Specialist"
        )
        service_name = booking.service.name if booking.service else "Service"
        booking_ref = booking.booking_reference or f"#{booking.id}"

        if notification_type == NotificationType.BOOKING_CONFIRMED:
            subject = "Service Booking Confirmed"
            message = (
                f"Hello {customer_name},\n\n"
                f"Your service booking has been confirmed.\n\n"
                f"Service: {service_name}\n"
                f"Provider: {provider_name}\n"
                f"Date: {booking.booking_date}\n"
                f"Time: {booking.booking_time}\n"
                f"Location: {booking.service_address}\n\n"
                f"Booking ID: #{booking_ref}\n\n"
                f"Thank you for using Smart Service Marketplace."
            )
        elif notification_type == NotificationType.BOOKING_REJECTED:
            subject = "Service Booking Cancelled"
            message = (
                f"Hello {customer_name},\n\n"
                f"Your service booking has been cancelled/rejected.\n\n"
                f"Service: {service_name}\n"
                f"Provider: {provider_name}\n"
                f"Booking ID: #{booking_ref}\n\n"
                f"Please check the marketplace for other available providers."
            )
        else:  # BOOKING_CANCELLED
            subject = "Service Booking Cancelled"
            message = (
                f"Hello {customer_name},\n\n"
                f"Your service booking has been cancelled.\n\n"
                f"Service: {service_name}\n"
                f"Provider: {provider_name}\n"
                f"Booking ID: #{booking_ref}\n\n"
                f"Please check the marketplace for other available providers."
            )

        sent_status = "SENT"
        error_msg = None

        # Check if real SMTP host is provided
        if settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            try:
                msg = MIMEMultipart()
                msg["From"] = settings.SMTP_FROM
                msg["To"] = recipient_email
                msg["Subject"] = subject
                msg.attach(MIMEText(message, "plain"))

                if settings.SMTP_PORT == 465:
                    server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                else:
                    server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                    if settings.SMTP_USE_TLS:
                        server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
                server.quit()
                sent_status = "SENT"
                logger.info(f"Email successfully delivered to {recipient_email} via SMTP [{subject}]")
            except Exception as e:
                sent_status = "FAILED"
                error_msg = str(e)
                logger.error(f"SMTP delivery failed to {recipient_email}: {e}")
        else:
            # Local dev / test SMTP environment: log clearly and record
            sent_status = "MOCK_SENT"
            logger.info(
                f"[LOCAL DEV EMAIL LOG]\nTo: {recipient_email}\nSubject: {subject}\n"
                f"Body:\n{message}\n"
                f"(Configure SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD in .env for live SMTP delivery)"
            )

        # Record notification in database
        notification_record = EmailNotification(
            booking_id=booking.id,
            recipient_email=recipient_email,
            notification_type=notification_type,
            subject=subject,
            body=message,
            sent_status=sent_status,
            error_message=error_msg
        )
        db.add(notification_record)
        db.commit()
        db.refresh(notification_record)
        return notification_record
