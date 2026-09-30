from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class ProviderAvailability(Base):
    __tablename__ = "provider_availability"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, ..., 6=Sunday
    start_time = Column(String(10), default="09:00", nullable=False)
    end_time = Column(String(10), default="18:00", nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)

    # Relationships
    provider = relationship("Provider", back_populates="availabilities")
