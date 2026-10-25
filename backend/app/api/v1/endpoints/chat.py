from datetime import datetime, timezone
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.chat import ChatConversation, ChatMessage
from app.models.user import User
from app.services.assistant_service import AssistantService

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


class ConversationCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)


class ConversationRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def title_must_contain_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank.")
        return value


class MessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    client_message_id: Optional[str] = Field(default=None, max_length=64)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location: Optional[str] = Field(default=None, max_length=300)

    @field_validator("message")
    @classmethod
    def message_must_contain_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be blank.")
        return value


def _conversation_or_404(db: Session, conversation_id: int, user_id: int) -> ChatConversation:
    conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == user_id,
    ).first()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation


def _message_payload(message: ChatMessage) -> dict[str, Any]:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "client_message_id": message.client_message_id,
        "created_at": message.created_at,
        **(message.metadata_json or {}),
    }


def _conversation_payload(conversation: ChatConversation) -> dict[str, Any]:
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "message_count": len(conversation.messages),
    }


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
def create_conversation(request: ConversationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conversation = ChatConversation(user_id=current_user.id, title=request.title.strip() if request.title else "New chat")
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return _conversation_payload(conversation)


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conversations = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).order_by(ChatConversation.updated_at.desc()).all()
    return [_conversation_payload(conversation) for conversation in conversations]


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conversation = _conversation_or_404(db, conversation_id, current_user.id)
    return [_message_payload(message) for message in conversation.messages]


@router.post("/conversations/{conversation_id}/messages")
async def create_message(conversation_id: int, request: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conversation = _conversation_or_404(db, conversation_id, current_user.id)
    user_message = None
    if request.client_message_id:
        user_message = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation.id,
            ChatMessage.client_message_id == request.client_message_id,
            ChatMessage.role == "user",
        ).first()
        if user_message:
            existing_assistant = db.query(ChatMessage).filter(
                ChatMessage.conversation_id == conversation.id,
                ChatMessage.id > user_message.id,
                ChatMessage.role == "assistant",
            ).order_by(ChatMessage.id.asc()).first()
            if existing_assistant:
                return {"user_message": _message_payload(user_message), "assistant_message": _message_payload(existing_assistant)}

    prior_messages = [
        {"role": message.role, "content": message.content}
        for message in conversation.messages[-6:]
        if not user_message or message.id != user_message.id
    ]
    if not user_message:
        user_message = ChatMessage(
            conversation_id=conversation.id,
            role="user",
            content=request.message,
            client_message_id=request.client_message_id,
        )
        db.add(user_message)
        if conversation.title == "New chat":
            conversation.title = request.message[:117] + "..." if len(request.message) > 120 else request.message
        db.commit()
        db.refresh(user_message)

    try:
        result = await AssistantService.process_chat(
            message=request.message,
            history=prior_messages,
            user_lat=request.latitude,
            user_lon=request.longitude,
            location=request.location,
            db=db,
        )
    except Exception as exc:
        db.rollback()
        logger.exception("Chat response generation failed for conversation %s", conversation.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Your message was saved, but the assistant response could not be generated. Please retry.",
        ) from exc

    assistant_message = ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=result["response"],
        metadata_json={
            "suggested_service": result.get("suggested_service"),
            "providers": result.get("providers", []),
            "actions": result.get("actions", []),
            "llm_called": result.get("llm_called", False),
            "llm_status": result.get("llm_status"),
            "llm_error": result.get("llm_error"),
        },
    )
    conversation.updated_at = datetime.now(timezone.utc)
    db.add(assistant_message)
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)
    return {"user_message": _message_payload(user_message), "assistant_message": _message_payload(assistant_message)}


@router.patch("/conversations/{conversation_id}")
def rename_conversation(conversation_id: int, request: ConversationRename, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conversation = _conversation_or_404(db, conversation_id, current_user.id)
    conversation.title = request.title
    db.commit()
    db.refresh(conversation)
    return _conversation_payload(conversation)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conversation = _conversation_or_404(db, conversation_id, current_user.id)
    db.delete(conversation)
    db.commit()