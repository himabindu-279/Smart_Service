from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from app.db.base_class import Base


class BookingEmailOutbox(Base):
    __tablename__ = "booking_email_outbox"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    event_key = Column(String(100), unique=True, nullable=False)
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(20), default="PENDING", nullable=False, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    available_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_booking_email_outbox_ready", "status", "available_at"),)