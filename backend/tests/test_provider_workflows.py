import asyncio
import smtplib
from io import BytesIO
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.testclient import TestClient
from starlette.datastructures import Headers
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from sqlalchemy import inspect, text

from app.api.deps import get_current_user
from app.api.v1.endpoints import admin, auth, bookings, maps, providers, services
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db import init_db
from app.db.session import get_db
from app.models.booking import Booking
from app.models.booking_email_outbox import BookingEmailOutbox
from app.models.category import Category
from app.models.email_verification import EmailVerification
from app.models.enums import BookingStatus, NotificationType, ServiceApprovalStatus, UserRole
from app.models.provider import Provider
from app.models.provider_document import ProviderDocument
from app.models.provider_service import ProviderService
from app.models.service import Service
from app.models.user import User
from app.schemas.booking import BookingUpdateStatus
from app.api.v1.endpoints.auth import ProviderEmailCode, ProviderEmailRequest
from app.schemas.user import ProviderRegistrationService, UserCreate
from app.services.auth_service import AuthService
from app.services.email_service import EmailService


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


def create_service(db: Session) -> Service:
    category = Category(name="Home Services", slug="home-services")
    db.add(category)
    db.flush()
    service = Service(
        category_id=category.id,
        name="Plumbing",
        slug="plumbing",
        base_price=450,
        is_active=True,
    )
    db.add(service)
    db.flush()
    return service


def create_provider(db: Session, service: Service, *, approved: bool = False):
    user = User(
        email=f"provider-{datetime.now(timezone.utc).timestamp()}@example.test",
        hashed_password=get_password_hash("test-password"),
        full_name="Rajam Plumbing",
        phone="9876543210",
        role=UserRole.PROVIDER,
        email_verified_at=datetime.now(timezone.utc),
        is_active=True,
    )
    db.add(user)
    db.flush()
    provider = Provider(
        user_id=user.id,
        business_name="Rajam Plumbing",
        address="Rajam",
        verification_status="APPROVED" if approved else "PENDING",
        is_verified=approved,
        is_available=approved,
    )
    db.add(provider)
    db.flush()
    offering = ProviderService(
        provider_id=provider.id,
        service_id=service.id,
        category_id=service.category_id,
        custom_service_name=service.name,
        custom_price=650,
        service_location="Rajam",
        service_latitude=18.45,
        service_longitude=83.65,
        service_radius_km=15,
        availability_hours="Weekdays",
        status=ServiceApprovalStatus.APPROVED if approved else ServiceApprovalStatus.PENDING,
        is_active=approved,
    )
    db.add(offering)
    db.flush()
    return user, provider, offering


def test_schema_migration_adds_columns_and_preserves_existing_provider_data(monkeypatch):
    engine = create_engine("sqlite://", poolclass=StaticPool)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        connection.execute(text(
            "CREATE TABLE providers (id INTEGER PRIMARY KEY, is_verified BOOLEAN NOT NULL)"
        ))
        connection.execute(text("CREATE TABLE provider_services (id INTEGER PRIMARY KEY)"))
        connection.execute(text("INSERT INTO providers (id, is_verified) VALUES (1, 1)"))
    monkeypatch.setattr(init_db, "engine", engine)

    init_db._ensure_marketplace_schema()
    init_db._ensure_marketplace_schema()

    inspector = inspect(engine)
    assert "email_verified_at" in {column["name"] for column in inspector.get_columns("users")}
    provider_columns = {column["name"] for column in inspector.get_columns("providers")}
    service_columns = {column["name"] for column in inspector.get_columns("provider_services")}
    assert {"verification_status", "service_radius_km"}.issubset(provider_columns)
    assert {"service_latitude", "service_longitude"}.issubset(service_columns)
    with engine.connect() as connection:
        provider = connection.execute(text(
            "SELECT verification_status, service_radius_km FROM providers WHERE id = 1"
        )).one()
    assert provider.verification_status == "APPROVED"
    assert provider.service_radius_km == 15
    engine.dispose()


def test_provider_registration_requires_verified_email_and_creates_pending_offer(db):
    service = create_service(db)
    email = "new-provider@example.com"
    db.add(EmailVerification(
        email=email,
        code_hash="test-hash",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        verified_at=datetime.now(timezone.utc),
    ))
    db.commit()

    user, token = AuthService.register_user(
        db,
        UserCreate(
            email=email,
            password="test-password",
            full_name="New Provider",
            phone="9876543210",
            role=UserRole.PROVIDER,
            address="Rajam",
            offered_services=[
                ProviderRegistrationService(
                    service_id=service.id,
                    base_price=700,
                    service_location="Rajam",
                    service_radius_km=20,
                    latitude=18.45,
                    longitude=83.65,
                )
            ],
        ),
    )

    offer = user.provider_profile.provider_services[0]
    assert token.access_token
    assert user.email_verified_at is not None
    assert user.provider_profile.verification_status == "PENDING"
    assert user.provider_profile.is_available is False
    assert user.provider_profile.service_radius_km == 20
    assert offer.status == ServiceApprovalStatus.PENDING
    assert offer.is_active is False
    assert (offer.service_location, offer.service_latitude, offer.service_longitude) == ("Rajam", 18.45, 83.65)


def test_provider_email_challenge_hashes_code_and_recovers_from_smtp_failure(db, monkeypatch):
    email = "verified-provider@example.com"

    def fail_sending(_recipient, _code):
        raise smtplib.SMTPAuthenticationError(535, b"SMTP authentication failed")

    monkeypatch.setattr(EmailService, "send_verification_code", staticmethod(fail_sending))
    with pytest.raises(HTTPException) as error:
        auth.send_provider_email_challenge(ProviderEmailRequest(email=email), db=db)
    assert error.value.status_code == 503

    challenge = db.query(EmailVerification).filter_by(email=email).one()
    last_sent_at = challenge.last_sent_at
    if last_sent_at.tzinfo is None:
        last_sent_at = last_sent_at.replace(tzinfo=timezone.utc)
    assert last_sent_at <= datetime.now(timezone.utc) - timedelta(seconds=50)
    delivered_codes = []
    monkeypatch.setattr(
        EmailService,
        "send_verification_code",
        staticmethod(lambda _recipient, code: delivered_codes.append(code)),
    )
    auth.send_provider_email_challenge(ProviderEmailRequest(email=email), db=db)

    assert len(delivered_codes) == 1
    assert challenge.code_hash != delivered_codes[0]
    wrong_code = "000001" if delivered_codes[0] != "000001" else "000002"
    with pytest.raises(HTTPException):
        auth.verify_provider_email(
            ProviderEmailCode(email=email, code=wrong_code),
            db=db,
        )
    verified = auth.verify_provider_email(
        ProviderEmailCode(email=email, code=delivered_codes[0]),
        db=db,
    )
    assert verified["verified"] is True
    assert challenge.verified_at is not None


def test_admin_approval_requires_documents_and_records_review(db):
    service = create_service(db)
    verification_time = datetime.now(timezone.utc)
    provider_user, provider, _ = create_provider(db, service)
    provider_user.email_verified_at = verification_time
    administrator = User(
        email="admin@example.test",
        hashed_password=get_password_hash("test-password"),
        full_name="Marketplace Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(administrator)
    db.commit()

    with pytest.raises(HTTPException) as error:
        admin.review_provider(
            provider.id,
            admin.ProviderReviewRequest(status="APPROVED"),
            current_admin=administrator,
            db=db,
        )
    assert error.value.status_code == 409

    db.add_all([
        ProviderDocument(
            provider_id=provider.id,
            document_type="IDENTITY",
            original_filename="identity.pdf",
            content_type="application/pdf",
            storage_name="identity-private.pdf",
        ),
        ProviderDocument(
            provider_id=provider.id,
            document_type="SERVICE_QUALIFICATION",
            original_filename="qualification.pdf",
            content_type="application/pdf",
            storage_name="qualification-private.pdf",
        ),
    ])
    db.commit()

    result = admin.review_provider(
        provider.id,
        admin.ProviderReviewRequest(status="APPROVED"),
        current_admin=administrator,
        db=db,
    )

    assert result["status"] == "APPROVED"
    assert provider.is_available is True
    assert provider.provider_services[0].status == ServiceApprovalStatus.APPROVED
    assert provider.provider_services[0].is_active is True
    listed_services = services.get_services(
        category_id=None,
        only_active_providers=True,
        db=db,
    )
    assert any(item["id"] == service.id and item["active_providers_count"] == 1 for item in listed_services)
    review = provider.verification_history[0]
    assert review.reviewer_id == administrator.id
    assert review.status == "APPROVED"


def test_provider_document_upload_validates_content_and_uses_private_storage(db, monkeypatch, tmp_path):
    service = create_service(db)
    provider_user, provider, _ = create_provider(db, service)
    monkeypatch.setattr(settings, "PRIVATE_UPLOAD_DIR", str(tmp_path))
    upload = UploadFile(
        filename="../../identity.pdf",
        file=BytesIO(b"%PDF-1.7\nprovider identity"),
        headers=Headers({"content-type": "application/pdf"}),
    )

    result = asyncio.run(providers.upload_provider_document(
        document_type="IDENTITY",
        upload=upload,
        current_user=provider_user,
        db=db,
    ))
    document = db.query(ProviderDocument).filter_by(provider_id=provider.id).one()

    assert result["document_type"] == "IDENTITY"
    assert document.original_filename == "identity.pdf"
    assert document.storage_name != document.original_filename
    assert (Path(tmp_path) / document.storage_name).read_bytes().startswith(b"%PDF-")

    invalid_upload = UploadFile(
        filename="bad.pdf",
        file=BytesIO(b"not a PDF"),
        headers=Headers({"content-type": "application/pdf"}),
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(providers.upload_provider_document(
            document_type="SERVICE_QUALIFICATION",
            upload=invalid_upload,
            current_user=provider_user,
            db=db,
        ))
    assert error.value.status_code == 415
    assert db.query(ProviderDocument).filter_by(provider_id=provider.id).count() == 1

    approved_user, approved_provider, _ = create_provider(db, service, approved=True)
    approved_upload = UploadFile(
        filename="updated-identity.pdf",
        file=BytesIO(b"%PDF-1.7\nupdated identity"),
        headers=Headers({"content-type": "application/pdf"}),
    )
    with pytest.raises(HTTPException) as approved_error:
        asyncio.run(providers.upload_provider_document(
            document_type="IDENTITY",
            upload=approved_upload,
            current_user=approved_user,
            db=db,
        ))
    assert approved_error.value.status_code == 403
    assert db.query(ProviderDocument).filter_by(provider_id=approved_provider.id).count() == 0


def test_nearby_search_uses_service_location_for_rajam_coverage(db):
    service = create_service(db)
    _, _, offer = create_provider(db, service, approved=True)

    matches = maps.get_nearby_providers(
        latitude=18.45,
        longitude=83.65,
        service_id=service.id,
        radius_km=15,
        db=db,
    )
    outside_coverage = maps.get_nearby_providers(
        latitude=18.9,
        longitude=83.65,
        service_id=service.id,
        radius_km=15,
        db=db,
    )

    assert len(matches) == 1
    assert matches[0]["provider_service_id"] == offer.id
    assert matches[0]["service_id"] == service.id
    assert matches[0]["price"] == 650
    assert matches[0]["address"] == "Rajam"
    assert outside_coverage == []


def test_booking_acceptance_commits_outbox_once_when_email_delivery_fails(db, monkeypatch):
    service = create_service(db)
    provider_user, provider, offer = create_provider(db, service, approved=True)
    customer = User(
        email="customer@example.test",
        hashed_password=get_password_hash("test-password"),
        full_name="Marketplace Customer",
        role=UserRole.USER,
        is_active=True,
    )
    db.add(customer)
    db.flush()
    booking = Booking(
        booking_reference="TEST-BOOKING-001",
        user_id=customer.id,
        provider_id=provider.id,
        provider_service_id=offer.id,
        service_id=service.id,
        booking_date="2030-01-01",
        booking_time="10:00",
        status=BookingStatus.PENDING,
        total_amount=650,
        service_address="Rajam",
    )
    db.add(booking)
    db.commit()
    monkeypatch.setattr(EmailService, "deliver_outbox_event", staticmethod(lambda _db, _event_id: "FAILED"))

    result = bookings.update_booking_status(
        booking.id,
        BookingUpdateStatus(status=BookingStatus.ACCEPTED),
        current_user=provider_user,
        db=db,
    )

    assert result["status"] == "ACCEPTED"
    assert result["email_status"] == "FAILED"
    assert db.query(Booking).filter_by(id=booking.id).one().status == BookingStatus.ACCEPTED
    assert db.query(BookingEmailOutbox).filter_by(
        booking_id=booking.id,
        event_key=f"booking:{booking.id}:{NotificationType.BOOKING_CONFIRMED.value}",
    ).count() == 1

    unchanged = bookings.update_booking_status(
        booking.id,
        BookingUpdateStatus(status=BookingStatus.ACCEPTED),
        current_user=provider_user,
        db=db,
    )
    assert unchanged["email_status"] is None
    assert db.query(BookingEmailOutbox).filter_by(booking_id=booking.id).count() == 1


def test_booking_email_outbox_retries_failed_delivery_and_deduplicates(db, monkeypatch):
    service = create_service(db)
    _, provider, _ = create_provider(db, service, approved=True)
    customer = User(
        email="retry-customer@example.com",
        hashed_password=get_password_hash("test-password"),
        full_name="Retry Customer",
        role=UserRole.USER,
        is_active=True,
    )
    db.add(customer)
    db.flush()
    booking = Booking(
        booking_reference="TEST-BOOKING-RETRY",
        user_id=customer.id,
        provider_id=provider.id,
        service_id=service.id,
        booking_date="2030-01-01",
        booking_time="10:00",
        status=BookingStatus.ACCEPTED,
        total_amount=650,
        service_address="Rajam",
    )
    db.add(booking)
    db.flush()
    event = EmailService.enqueue_booking_status_email(
        db,
        booking,
        NotificationType.BOOKING_CONFIRMED,
    )
    db.commit()
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_USERNAME", "mailer")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "test-only")

    def fail_delivery(*_args, **_kwargs):
        raise RuntimeError("temporary SMTP failure")

    monkeypatch.setattr("app.services.email_service._send_smtp_message", fail_delivery)
    assert EmailService.deliver_outbox_event(db, event.id) == "FAILED"
    db.refresh(event)
    assert event.attempts == 1

    event.available_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    monkeypatch.setattr("app.services.email_service._send_smtp_message", lambda *_args, **_kwargs: None)
    assert EmailService.deliver_outbox_event(db, event.id) == "SENT"
    assert EmailService.deliver_outbox_event(db, event.id) == "SENT"
    assert db.query(BookingEmailOutbox).filter_by(booking_id=booking.id).count() == 1
    from app.models.email_notification import EmailNotification
    assert db.query(EmailNotification).filter_by(booking_id=booking.id).count() == 1


def test_admin_routes_reject_provider_accounts(db):
    service = create_service(db)
    provider_user, _, _ = create_provider(db, service)
    app = FastAPI()
    app.include_router(admin.router, prefix="/admin")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: provider_user

    response = TestClient(app).get("/admin/providers")
    document_response = TestClient(app).get("/admin/provider-documents/1/download")

    assert response.status_code == 403
    assert document_response.status_code == 403
