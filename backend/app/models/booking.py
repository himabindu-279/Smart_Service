from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from app.models.enums import BookingStatus


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_reference = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_service_id = Column(Integer, ForeignKey("provider_services.id", ondelete="SET NULL"), nullable=True, index=True)
    booking_date = Column(String(20), nullable=False)
    booking_time = Column(String(20), nullable=False)
    status = Column(SQLEnum(BookingStatus), default=BookingStatus.PENDING, nullable=False, index=True)
    total_amount = Column(Float, default=0.0, nullable=False)
    service_address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    special_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="bookings")
    provider = relationship("Provider", back_populates="bookings")
    service = relationship("Service", back_populates="bookings")
    provider_service = relationship("ProviderService")
    review = relationship("Review", back_populates="booking", uselist=False, cascade="all, delete-orphan")
    rating = relationship("Rating", back_populates="booking", uselist=False, cascade="all, delete-orphan")
