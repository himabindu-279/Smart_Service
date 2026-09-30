from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ServiceBase(BaseModel):
    category_id: int
    name: str
    slug: str
    description: Optional[str] = None
    base_price: float = 0.0
    estimated_duration_minutes: int = 60
    is_active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceResponse(ServiceBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
