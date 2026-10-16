from typing import List, Literal, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.assistant_service import AssistantService

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: Optional[List[ChatMessage]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location: Optional[str] = Field(None, max_length=300)

    @field_validator("message")
    @classmethod
    def message_must_contain_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message cannot be blank.")
        return value.strip()


@router.post("/chat")
async def chat_with_assistant(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    RAG-powered AI Service Assistant.
    Retrieves marketplace services/providers from PostgreSQL and produces diagnostic recommendations.
    """
    history_dicts = [h.model_dump() for h in request.history] if request.history else []
    result = await AssistantService.process_chat(
        message=request.message,
        history=history_dicts,
        user_lat=request.latitude,
        user_lon=request.longitude,
        location=request.location,
        db=db
    )
    return result
