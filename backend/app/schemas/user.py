from typing import Literal, Optional
from datetime import datetime
from typing import List
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from app.models.enums import UserRole
from app.schemas.provider import ProviderResponse


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.USER


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    role: UserRole = UserRole.USER
    
    # Optional Provider specific registration fields
    business_name: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = 0
    qualifications: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    offered_services: List["ProviderRegistrationService"] = Field(default_factory=list, max_length=20)


class ProviderRegistrationService(BaseModel):
    service_id: int = Field(gt=0)
    base_price: float = Field(gt=0, le=1000000)
    description: Optional[str] = Field(default=None, max_length=2000)
    service_location: str = Field(min_length=3, max_length=255)
    service_radius_km: float = Field(default=15, gt=0, le=200)
    availability_hours: Optional[str] = Field(default=None, max_length=255)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2)
    phone: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    preferred_language: Optional[Literal["en", "te", "hi"]] = None


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    preferred_language: Literal["en", "te", "hi"] = "en"
    role: UserRole
    is_active: bool
    created_at: datetime
    provider_profile: Optional[ProviderResponse] = None

    model_config = ConfigDict(from_attributes=True)
