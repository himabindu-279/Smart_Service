from typing import Optional, Any
from pydantic import BaseModel
from app.models.enums import UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Any


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[UserRole] = None
    exp: Optional[int] = None


class LoginRequest(BaseModel):
    email: str
    password: str
