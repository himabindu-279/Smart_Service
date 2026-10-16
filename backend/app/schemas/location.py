from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class LocationBase(BaseModel):
    title: str = "Home"
    address_line: str
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: float
    longitude: float
    is_primary: bool = False


class LocationCreate(LocationBase):
    city: str = "Saved location"
    latitude: float
    longitude: float


class LocationResponse(LocationBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
