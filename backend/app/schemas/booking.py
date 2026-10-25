import re
from datetime import date, datetime, time
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from app.models.enums import BookingStatus


class BookingBase(BaseModel):
    provider_id: int
    service_id: int
    customer_full_name: Optional[str] = Field(default=None, max_length=255)
    customer_mobile: Optional[str] = Field(default=None, max_length=20)
    customer_email: Optional[EmailStr] = None
    booking_date: date
    booking_time: time
    service_address: str = Field(min_length=5, max_length=500)
    address: Optional[str] = None
    provider_service_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    special_instructions: Optional[str] = None
    notes: Optional[str] = None
    estimated_price: Optional[float] = None

    @field_validator("customer_full_name")
    @classmethod
    def validate_customer_name(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("Enter the customer's full name")
        return normalized

    @field_validator("customer_mobile")
    @classmethod
    def validate_customer_mobile(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        value = value.strip()
        digits = re.sub(r"\D", "", value)
        if not 8 <= len(digits) <= 15 or not re.fullmatch(r"\+?[0-9().\s-]+", value):
            raise ValueError("Enter a valid phone number with 8 to 15 digits")
        return f"+{digits}" if value.startswith("+") else digits

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data):
        if isinstance(data, dict):
            if not data.get("service_address") and data.get("address"):
                data["service_address"] = data["address"]

            b_date = data.get("booking_date", "")
            if "T" in str(b_date):
                parts = str(b_date).split("T")
                data["booking_date"] = parts[0]
                if not data.get("booking_time") and len(parts) > 1:
                    data["booking_time"] = parts[1][:5]

            if not data.get("special_instructions") and data.get("notes"):
                data["special_instructions"] = data["notes"]
        return data

    @model_validator(mode="after")
    def validate_future_slot(self):
        requested = datetime.combine(self.booking_date, self.booking_time)
        local_now = datetime.now().astimezone().replace(tzinfo=None)
        if requested <= local_now:
            raise ValueError("Choose a booking date and time in the future")
        return self


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
