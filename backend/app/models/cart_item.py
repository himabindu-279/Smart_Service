from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_service_id = Column(Integer, ForeignKey("provider_services.id", ondelete="SET NULL"), nullable=True, index=True)
    cart_key = Column(String(100), nullable=False)
    booking_date = Column(String(10), nullable=True)
    booking_time = Column(String(8), nullable=True)
    service_address = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    special_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="cart_items")
    service = relationship("Service")
    provider_service = relationship("ProviderService")

    __table_args__ = (
        UniqueConstraint("user_id", "cart_key", name="uq_user_cart_item_key"),
    )
