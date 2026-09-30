from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import BookingStatus


class BookingBase(BaseModel):
    provider_id: int
    service_id: int
    booking_date: str
    booking_time: str
    service_address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    special_instructions: Optional[str] = None


class BookingCreate(BookingBase):
    pass


class BookingUpdateStatus(BaseModel):
    status: BookingStatus


class BookingResponse(BookingBase):
    id: int
    booking_reference: str
    user_id: int
    status: BookingStatus
    total_amount: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
