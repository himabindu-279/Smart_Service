from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ProviderBase(BaseModel):
    business_name: Optional[str] = None
    bio: Optional[str] = None
    experience_years: int = 0
    qualifications: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_available: bool = True


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    business_name: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    qualifications: Optional[str] = None
    profile_image: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_available: Optional[bool] = None


class ProviderResponse(ProviderBase):
    id: int
    user_id: int
    profile_image: Optional[str] = None
    is_verified: bool
    rating_avg: float
    total_ratings: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
