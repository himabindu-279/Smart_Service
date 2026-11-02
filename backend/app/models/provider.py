from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    business_name = Column(String(200), nullable=True)
    bio = Column(Text, nullable=True)
    experience_years = Column(Integer, default=0, nullable=False)
    qualifications = Column(String(300), nullable=True)
    profile_image = Column(String(500), nullable=True)
    address = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    service_radius_km = Column(Float, default=15.0, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_status = Column(String(20), default="PENDING", nullable=False, index=True)
    is_available = Column(Boolean, default=True, nullable=False)
    rating_avg = Column(Float, default=0.0, nullable=False)
    total_ratings = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="provider_profile")
    provider_services = relationship("ProviderService", back_populates="provider", cascade="all, delete-orphan")
    availabilities = relationship("ProviderAvailability", back_populates="provider", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="provider", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="provider", cascade="all, delete-orphan")
    ratings = relationship("Rating", back_populates="provider", cascade="all, delete-orphan")
    verification_history = relationship(
        "ProviderVerification",
        back_populates="provider",
        cascade="all, delete-orphan",
        order_by="ProviderVerification.created_at.desc()",
    )
    documents = relationship("ProviderDocument", back_populates="provider", cascade="all, delete-orphan")
