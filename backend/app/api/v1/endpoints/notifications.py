from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter()


def _notification_payload(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "booking_id": notification.booking_id,
        "event_type": notification.event_type,
        "channel": notification.channel,
        "title": notification.title,
        "body": notification.body,
        "status": notification.status,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "delivered_at": notification.delivered_at.isoformat() if notification.delivered_at else None,
        "last_error": notification.last_error if notification.status == "FAILED" else None,
    }


@router.get("")
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    base_query = db.query(Notification).filter(Notification.user_id == current_user.id)
    unread_count = base_query.filter(
        Notification.channel == "IN_APP",
        Notification.is_read.is_(False),
    ).with_entities(func.count(Notification.id)).scalar() or 0
    notifications = base_query.order_by(
        Notification.created_at.desc(),
        Notification.id.desc(),
    ).limit(limit).all()
    return {
        "notifications": [_notification_payload(item) for item in notifications],
        "unread_count": unread_count,
    }


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
        Notification.channel == "IN_APP",
    ).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    if not notification.is_read:
        notification.is_read = True
        notification.status = "READ"
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return _notification_payload(notification)


@router.patch("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    changed = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.channel == "IN_APP",
        Notification.is_read.is_(False),
    ).update(
        {"is_read": True, "status": "READ", "read_at": now},
        synchronize_session=False,
    )
    db.commit()
    return {"updated": changed, "read_at": now.isoformat()}
