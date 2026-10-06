from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, model_validator
from app.models.enums import BookingStatus


class BookingBase(BaseModel):
    provider_id: int
    service_id: int
    booking_date: str
    booking_time: Optional[str] = "10:00"
    service_address: Optional[str] = "Service Location"
    address: Optional[str] = None
    provider_service_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    special_instructions: Optional[str] = None
    notes: Optional[str] = None
    estimated_price: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        if isinstance(data, dict):
            # Address normalization
            if not data.get("service_address") and data.get("address"):
                data["service_address"] = data["address"]
            elif not data.get("service_address"):
                data["service_address"] = "Service Location"
            
            # ISO date/time string normalization (e.g. 2026-10-07T10:00:00)
            b_date = data.get("booking_date", "")
            if "T" in str(b_date):
                parts = str(b_date).split("T")
                data["booking_date"] = parts[0]
                if not data.get("booking_time") and len(parts) > 1:
                    data["booking_time"] = parts[1][:5]
            if not data.get("booking_time"):
                data["booking_time"] = "10:00"

            # Instructions normalization
            if not data.get("special_instructions") and data.get("notes"):
                data["special_instructions"] = data["notes"]
        return data


class BookingCreate(BookingBase):
    pass


class BookingUpdateStatus(BaseModel):
    status: BookingStatus


class BookingResponse(BaseModel):
    id: int
    booking_reference: str
    user_id: int
    provider_id: int
    service_id: int
    booking_date: str
    booking_time: str
    service_address: str
    status: BookingStatus
    total_amount: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
