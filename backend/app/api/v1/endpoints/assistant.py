from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.assistant_service import AssistantService

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    latitude: Optional[float] = 12.9716
    longitude: Optional[float] = 77.5946


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
        db=db
    )
    return result
