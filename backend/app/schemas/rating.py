from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class RatingBase(BaseModel):
    booking_id: int
    score: float = Field(..., ge=1.0, le=5.0)
    aspect_punctuality: Optional[float] = Field(None, ge=1.0, le=5.0)
    aspect_quality: Optional[float] = Field(None, ge=1.0, le=5.0)
    aspect_cost: Optional[float] = Field(None, ge=1.0, le=5.0)


class RatingCreate(RatingBase):
    pass


class RatingResponse(RatingBase):
    id: int
    user_id: int
    provider_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
