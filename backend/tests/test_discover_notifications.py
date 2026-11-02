import asyncio
from io import BytesIO

import httpx
import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from starlette.datastructures import Headers

from app.api.v1.endpoints import ai, notifications
from app.core.security import get_password_hash
from app.db.base import Base
from app.models.enums import UserRole
from app.models.notification import Notification
from app.models.problem_image import ProblemImage
from app.models.user import User
from app.services import notification_service
from app.services.notification_service import NotificationService


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def create_user(db: Session, email: str, role: UserRole = UserRole.USER) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("test-password"),
        full_name="Test User",
        phone="+15551234567",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def test_problem_image_upload_is_validated_private_and_user_scoped(db, tmp_path, monkeypatch):
    user = create_user(db, "customer@example.test")
    other_user = create_user(db, "other@example.test")
    monkeypatch.setattr(ai.settings, "PRIVATE_UPLOAD_DIR", str(tmp_path))
    payload = b"\xff\xd8\xff" + b"test-image-content"
    upload = UploadFile(
        filename="repair.jpg",
        file=BytesIO(payload),
        headers=Headers({"content-type": "image/jpeg"}),
    )

    result = asyncio.run(ai.upload_problem_image(upload, user, db))
    image = db.query(ProblemImage).filter_by(id=result["image_id"]).one()
    stored_path = tmp_path / "problem-images" / image.storage_name
    assert result["content_type"] == "image/jpeg"
    assert stored_path.read_bytes() == payload
    assert "problem-images" not in result["filename"]

    with pytest.raises(HTTPException) as error:
        ai.get_problem_image(image.id, other_user, db)
    assert error.value.status_code == 404

    invalid_upload = UploadFile(
        filename="not-an-image.jpg",
        file=BytesIO(b"not an image"),
        headers=Headers({"content-type": "image/jpeg"}),
    )
    with pytest.raises(HTTPException) as invalid_error:
        asyncio.run(ai.upload_problem_image(invalid_upload, user, db))
    assert invalid_error.value.status_code == 415


def test_analysis_passes_owned_uploaded_image_to_configured_analyzer(db, tmp_path, monkeypatch):
    user = create_user(db, "image-owner@example.test")
    other_user = create_user(db, "image-other@example.test")
    monkeypatch.setattr(ai.settings, "PRIVATE_UPLOAD_DIR", str(tmp_path))
    path = tmp_path / "problem-images"
    path.mkdir()
    image_data = b"\x89PNG\r\n\x1a\nactual-test-content"
    image = ProblemImage(
        user_id=user.id,
        storage_name="image.png",
        content_type="image/png",
        original_filename="issue.png",
    )
    db.add(image)
    db.commit()
    (path / image.storage_name).write_bytes(image_data)

    async def fake_analyze(query, location, session, image_bytes=None, image_mime=None):
        assert query == "A pipe is leaking"
        assert image_bytes == image_data
        assert image_mime == "image/png"
        return {"image_context_used": True}

    monkeypatch.setattr(ai.ProblemAnalyzer, "analyze", fake_analyze)
    result = asyncio.run(ai.analyze_problem_endpoint(
        ai.ProblemAnalysisRequest(query="A pipe is leaking", image_id=image.id),
        db,
        user,
    ))
    assert result["image_attached"] is True
    assert result["image_context_used"] is True

    with pytest.raises(HTTPException) as error:
        asyncio.run(ai.analyze_problem_endpoint(
            ai.ProblemAnalysisRequest(query="A pipe is leaking", image_id=image.id),
            db,
            other_user,
        ))
    assert error.value.status_code == 404


def test_notifications_are_idempotent_readable_and_user_scoped(db, monkeypatch):
    recipient = create_user(db, "recipient@example.test")
    other_user = create_user(db, "unrelated@example.test")
    NotificationService.enqueue(
        db,
        event_key="booking:55:submitted",
        event_type="BOOKING_SUBMITTED",
        title="Booking request submitted",
        body="Plumbing appointment requested.",
        recipients=[recipient],
    )
    NotificationService.enqueue(
        db,
        event_key="booking:55:submitted",
        event_type="BOOKING_SUBMITTED",
        title="Booking request submitted",
        body="Plumbing appointment requested.",
        recipients=[recipient],
    )
    db.commit()

    result = notifications.list_notifications(limit=30, current_user=recipient, db=db)
    assert result["unread_count"] == 1
    assert len(result["notifications"]) == 2
    in_app = next(item for item in result["notifications"] if item["channel"] == "IN_APP")
    read_result = notifications.mark_notification_read(in_app["id"], recipient, db)
    assert read_result["status"] == "READ"
    assert notifications.list_notifications(limit=30, current_user=recipient, db=db)["unread_count"] == 0

    with pytest.raises(HTTPException) as error:
        notifications.mark_notification_read(in_app["id"], other_user, db)
    assert error.value.status_code == 404

    sms_row = db.query(Notification).filter_by(channel="SMS").one()
    assert sms_row.status == "PENDING"
    monkeypatch.setattr(notification_service.settings, "SMS_PROVIDER", "")
    assert notification_service.process_due_sms_notifications() == 0


def test_twilio_sms_sender_uses_configured_backend_credentials(monkeypatch, db):
    recipient = create_user(db, "sms@example.test")
    row = Notification(
        user_id=recipient.id,
        event_key="booking:88:accepted:1:SMS",
        event_type="BOOKING_ACCEPTED",
        channel="SMS",
        recipient=recipient.phone,
        title="Booking accepted",
        body="Your appointment was accepted.",
        status="PENDING",
    )
    db.add(row)
    db.flush()
    monkeypatch.setattr(notification_service.settings, "SMS_PROVIDER", "twilio")
    monkeypatch.setattr(notification_service.settings, "TWILIO_ACCOUNT_SID", "test-account")
    monkeypatch.setattr(notification_service.settings, "TWILIO_AUTH_TOKEN", "test-token")
    monkeypatch.setattr(notification_service.settings, "TWILIO_FROM_NUMBER", "+15557654321")
    sent = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

    def fake_post(url, **kwargs):
        sent["url"] = url
        sent.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(httpx, "post", fake_post)
    notification_service._send_twilio_sms(row)
    assert sent["auth"] == ("test-account", "test-token")
    assert sent["data"]["To"] == recipient.phone
    assert sent["data"]["From"] == "+15557654321"
    assert sent["headers"]["I-Twilio-Idempotency-Token"] == row.event_key
