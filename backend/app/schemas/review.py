from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReviewBase(BaseModel):
    booking_id: int
    review_text: str = Field(..., min_length=3)


class ReviewCreate(ReviewBase):
    pass


class ReviewResponse(ReviewBase):
    id: int
    user_id: int
    provider_id: int
    service_id: int
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
