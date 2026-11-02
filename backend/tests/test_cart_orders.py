from datetime import date, time, timedelta

import pytest
from fastapi import HTTPException, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints import orders
from app.core.security import get_password_hash
from app.db.base import Base
from app.ml.bge_m3_matcher import BGEM3Matcher
from app.models.booking import Booking
from app.models.category import Category
from app.models.enums import BookingStatus, ServiceApprovalStatus, UserRole
from app.models.provider import Provider
from app.models.provider_service import ProviderService
from app.models.service import Service
from app.models.service_order import ServiceOrder
from app.models.user import User
from app.schemas.orders import CartItemCreate, CartItemUpdate, CheckoutRequest
from app.services.language_service import detect_language


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


def create_service(db: Session, name: str, slug: str, price: float = 400) -> Service:
    category = db.query(Category).filter_by(slug="home-services").first()
    if category is None:
        category = Category(name="Home Services", slug="home-services")
        db.add(category)
        db.flush()
    service = Service(
        category_id=category.id,
        name=name,
        slug=slug,
        description=f"{name} services",
        base_price=price,
        estimated_duration_minutes=60,
        is_active=True,
    )
    db.add(service)
    db.flush()
    return service


def create_customer(db: Session, email: str = "customer@example.com") -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("test-password"),
        full_name="Marketplace Customer",
        phone="9876543210",
        role=UserRole.USER,
        is_active=True,
        preferred_language="en",
    )
    db.add(user)
    db.flush()
    return user


def create_offer(db: Session, service: Service, price: float = 650):
    provider_user = User(
        email=f"provider-{service.slug}@example.test",
        hashed_password=get_password_hash("test-password"),
        full_name=f"{service.name} Provider",
        role=UserRole.PROVIDER,
        is_active=True,
    )
    db.add(provider_user)
    db.flush()
    provider = Provider(
        user_id=provider_user.id,
        business_name=f"{service.name} Provider",
        address="Rajam",
        latitude=18.45,
        longitude=83.65,
        service_radius_km=15,
        verification_status="APPROVED",
        is_verified=True,
        is_available=True,
    )
    db.add(provider)
    db.flush()
    offer = ProviderService(
        provider_id=provider.id,
        service_id=service.id,
        category_id=service.category_id,
        custom_service_name=service.name,
        custom_price=price,
        service_location="Rajam",
        service_latitude=18.45,
        service_longitude=83.65,
        service_radius_km=15,
        status=ServiceApprovalStatus.APPROVED,
        is_active=True,
    )
    db.add(offer)
    db.flush()
    return provider, offer


def add_scheduled_item(db: Session, user: User, service: Service, offer: ProviderService, day: date, slot: time):
    response = Response()
    created = orders.add_cart_item(
        CartItemCreate(service_id=service.id, provider_service_id=offer.id),
        response=response,
        current_user=user,
        db=db,
    )
    item_id = created["item"]["id"]
    orders.update_cart_item(
        item_id,
        CartItemUpdate(
            booking_date=day,
            booking_time=slot,
            service_address="Rajam",
            latitude=18.45,
            longitude=83.65,
        ),
        current_user=user,
        db=db,
    )
    return item_id


def checkout_request(user: User, item_ids: list[int], key: str = "checkout-request-key-001"):
    return CheckoutRequest(
        item_ids=item_ids,
        idempotency_key=key,
        customer_full_name="Marketplace Customer",
        customer_mobile="9876543210",
        customer_email=user.email,
        service_address="Rajam",
        latitude=18.45,
        longitude=83.65,
    )


def test_cart_deduplicates_same_service_provider_and_removes_only_owned_items(db):
    customer = create_customer(db)
    service = create_service(db, "Plumbing", "plumbing")
    _, offer = create_offer(db, service)
    first_response = Response()
    first = orders.add_cart_item(
        CartItemCreate(service_id=service.id, provider_service_id=offer.id),
        response=first_response,
        current_user=customer,
        db=db,
    )
    repeated_response = Response()
    repeated = orders.add_cart_item(
        CartItemCreate(service_id=service.id, provider_service_id=offer.id),
        response=repeated_response,
        current_user=customer,
        db=db,
    )

    assert first["created"] is True
    assert repeated["created"] is False
    assert repeated_response.status_code == 200
    assert len(orders.get_cart(current_user=customer, db=db)["items"]) == 1

    other_customer = create_customer(db, "other@example.com")
    with pytest.raises(HTTPException) as error:
        orders.remove_cart_item(first["item"]["id"], current_user=other_customer, db=db)
    assert error.value.status_code == 404


def test_combined_checkout_uses_provider_prices_and_is_idempotent(db):
    customer = create_customer(db)
    plumbing = create_service(db, "Plumbing", "plumbing", 100)
    electrical = create_service(db, "Electrical", "electrical", 150)
    _, plumbing_offer = create_offer(db, plumbing, 650)
    _, electrical_offer = create_offer(db, electrical, 550)
    appointment_date = date.today() + timedelta(days=14)
    item_ids = [
        add_scheduled_item(db, customer, plumbing, plumbing_offer, appointment_date, time(10, 0)),
        add_scheduled_item(db, customer, electrical, electrical_offer, appointment_date, time(12, 0)),
    ]

    first = orders.checkout(
        checkout_request(customer, item_ids),
        response=Response(),
        current_user=customer,
        db=db,
    )
    retry_response = Response()
    retry = orders.checkout(
        checkout_request(customer, item_ids),
        response=retry_response,
        current_user=customer,
        db=db,
    )

    assert first["order_reference"].startswith("ORD-")
    assert first["total_amount"] == 1200
    assert len(first["items"]) == 2
    assert sorted(item["price"] for item in first["items"]) == [550, 650]
    assert retry["id"] == first["id"]
    assert retry_response.status_code == 200
    assert db.query(ServiceOrder).count() == 1
    assert db.query(Booking).filter(Booking.order_id == first["id"]).count() == 2
    assert orders.get_cart(current_user=customer, db=db)["items"] == []


def test_checkout_conflict_keeps_cart_and_creates_no_partial_order(db):
    customer = create_customer(db)
    service = create_service(db, "Plumbing", "plumbing")
    provider, offer = create_offer(db, service)
    appointment_date = date.today() + timedelta(days=20)
    item_id = add_scheduled_item(db, customer, service, offer, appointment_date, time(10, 0))
    db.add(Booking(
        booking_reference="EXISTING-BOOKING",
        user_id=customer.id,
        provider_id=provider.id,
        provider_service_id=offer.id,
        service_id=service.id,
        booking_date=appointment_date.isoformat(),
        booking_time="10:30",
        status=BookingStatus.ACCEPTED,
        total_amount=650,
        service_address="Rajam",
        latitude=18.45,
        longitude=83.65,
    ))
    db.commit()

    with pytest.raises(HTTPException) as error:
        orders.checkout(
            checkout_request(customer, [item_id]),
            response=Response(),
            current_user=customer,
            db=db,
        )

    assert error.value.status_code == 409
    assert db.query(ServiceOrder).count() == 0
    assert len(orders.get_cart(current_user=customer, db=db)["items"]) == 1


def test_checkout_rejects_unresolvable_address_without_clearing_cart(db, monkeypatch):
    customer = create_customer(db)
    service = create_service(db, "Plumbing", "plumbing")
    _, offer = create_offer(db, service)
    appointment_date = date.today() + timedelta(days=21)
    item_id = add_scheduled_item(db, customer, service, offer, appointment_date, time(10, 0))
    request = checkout_request(customer, [item_id])
    request.latitude = None
    request.longitude = None
    monkeypatch.setattr(orders, "geocode_location", lambda _address: [])

    with pytest.raises(HTTPException) as error:
        orders.checkout(request, response=Response(), current_user=customer, db=db)

    assert error.value.status_code == 422
    assert db.query(ServiceOrder).count() == 0
    assert len(orders.get_cart(current_user=customer, db=db)["items"]) == 1


def test_multilingual_service_aliases_map_to_canonical_service_slugs():
    assert BGEM3Matcher.explicit_service_slug("AC repair is needed") == "ac-repair"
    assert BGEM3Matcher.explicit_service_slug("ఏసీ రిపేర్ కావాలి") == "ac-repair"
    assert BGEM3Matcher.explicit_service_slug("मुझे एसी मरम्मत चाहिए") == "ac-repair"
    assert BGEM3Matcher.explicit_service_slug("పైపు లీకేజ్") == "plumbing"
    assert BGEM3Matcher.explicit_service_slug("नल की मरम्मत") == "plumbing"
    assert detect_language("ఏసీ రిపేర్ కావాలి") == "te"
    assert detect_language("एसी मरम्मत चाहिए") == "hi"
    assert detect_language("AC repair", fallback="te") == "te"
