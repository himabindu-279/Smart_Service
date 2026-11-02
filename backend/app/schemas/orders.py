from datetime import date, time
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class CartItemCreate(BaseModel):
    service_id: int = Field(gt=0)
    provider_service_id: Optional[int] = Field(default=None, gt=0)


class CartItemUpdate(BaseModel):
    provider_service_id: Optional[int] = Field(default=None, gt=0)
    booking_date: Optional[date] = None
    booking_time: Optional[time] = None
    service_address: Optional[str] = Field(default=None, min_length=5, max_length=500)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    special_instructions: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def coordinates_are_a_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together.")
        return self


class CheckoutRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=20)
    idempotency_key: str = Field(min_length=16, max_length=100)
    customer_full_name: str = Field(min_length=2, max_length=255)
    customer_mobile: str = Field(min_length=8, max_length=20)
    customer_email: EmailStr
    service_address: str = Field(min_length=5, max_length=500)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_request(self):
        if len(set(self.item_ids)) != len(self.item_ids):
            raise ValueError("A cart item may only appear once per checkout.")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together.")
        digits = "".join(character for character in self.customer_mobile if character.isdigit())
        if not 8 <= len(digits) <= 15:
            raise ValueError("Enter a valid phone number with 8 to 15 digits.")
        return self
