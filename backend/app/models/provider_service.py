from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from app.models.enums import ServiceApprovalStatus


class ProviderService(Base):
    __tablename__ = "provider_services"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    custom_service_name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    experience = Column(String(100), nullable=True)
    custom_price = Column(Float, nullable=False, default=0.0)
    service_location = Column(String(255), nullable=True)
    service_radius_km = Column(Float, default=15.0)
    availability_hours = Column(String(255), nullable=True)
    image_url = Column(String(500), nullable=True)
    status = Column(
        SQLEnum(ServiceApprovalStatus),
        default=ServiceApprovalStatus.PENDING,
        nullable=False,
        index=True
    )
    is_active = Column(Boolean, default=True, nullable=False)
    rejection_reason = Column(Text, nullable=True)
    experience_description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint("provider_id", "service_id", name="uq_provider_service"),
    )

    # Relationships
    provider = relationship("Provider", back_populates="provider_services")
    service = relationship("Service", back_populates="provider_services")
    category = relationship("Category")
