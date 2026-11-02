import uuid
from datetime import datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.db.session import get_db
from app.models.booking import Booking
from app.models.cart_item import CartItem
from app.models.enums import BookingStatus, ServiceApprovalStatus, UserRole
from app.models.provider import Provider
from app.models.provider_availability import ProviderAvailability
from app.models.provider_service import ProviderService
from app.models.service import Service
from app.models.service_order import ServiceOrder
from app.models.user import User
from app.schemas.orders import CartItemCreate, CartItemUpdate, CheckoutRequest
from app.utils.geo import geocode_location, haversine_distance

router = APIRouter()
ACTIVE_BOOKING_STATUSES = [
    BookingStatus.PENDING,
    BookingStatus.ACCEPTED,
    BookingStatus.IN_PROGRESS,
]


def _require_customer(user: User) -> None:
    if user.role != UserRole.USER:
        raise HTTPException(status_code=403, detail="Only customer accounts can manage a cart or place orders.")


def _eligible_offer(db: Session, service_id: int, provider_service_id: int) -> ProviderService:
    offering = (
        db.query(ProviderService)
        .join(Provider, Provider.id == ProviderService.provider_id)
        .join(User, User.id == Provider.user_id)
        .filter(
            ProviderService.id == provider_service_id,
            ProviderService.service_id == service_id,
            ProviderService.is_active.is_(True),
            ProviderService.status == ServiceApprovalStatus.APPROVED,
            Provider.verification_status == "APPROVED",
            Provider.is_available.is_(True),
            User.is_active.is_(True),
        )
        .with_for_update()
        .first()
    )
    if not offering:
        raise HTTPException(
            status_code=409,
            detail="That provider no longer has an approved, active offer for this service.",
        )
    return offering


def _available_offers(db: Session, service_id: int) -> list[dict]:
    offers = (
        db.query(ProviderService, Provider, User)
        .join(Provider, Provider.id == ProviderService.provider_id)
        .join(User, User.id == Provider.user_id)
        .filter(
            ProviderService.service_id == service_id,
            ProviderService.is_active.is_(True),
            ProviderService.status == ServiceApprovalStatus.APPROVED,
            Provider.verification_status == "APPROVED",
            Provider.is_available.is_(True),
            User.is_active.is_(True),
        )
        .order_by(ProviderService.custom_price.asc())
        .all()
    )
    return [
        {
            "provider_service_id": offering.id,
            "provider_id": provider.id,
            "provider_name": provider.business_name or user.full_name,
            "rating": provider.rating_avg,
            "total_ratings": provider.total_ratings,
            "price": offering.custom_price,
            "availability": offering.availability_hours,
            "address": offering.service_location or provider.address,
            "latitude": offering.service_latitude if offering.service_latitude is not None else provider.latitude,
            "longitude": offering.service_longitude if offering.service_longitude is not None else provider.longitude,
            "coverage_radius_km": offering.service_radius_km,
        }
        for offering, provider, user in offers
    ]


def _cart_item_response(db: Session, item: CartItem) -> dict:
    service = db.query(Service).filter(Service.id == item.service_id).first()
    if not service:
        raise HTTPException(status_code=409, detail="A service in your cart is no longer available.")
    selected_offer = None
    if item.provider_service_id:
        selected_offer = db.query(ProviderService).filter(
            ProviderService.id == item.provider_service_id
        ).first()
    selected = None
    if selected_offer:
        provider = selected_offer.provider
        selected = {
            "provider_service_id": selected_offer.id,
            "provider_id": provider.id,
            "provider_name": provider.business_name or provider.user.full_name,
            "price": selected_offer.custom_price,
            "availability": selected_offer.availability_hours,
            "address": selected_offer.service_location or provider.address,
        }
    return {
        "id": item.id,
        "service_id": service.id,
        "service_name": service.name,
        "service_slug": service.slug,
        "description": service.description,
        "provider_service_id": item.provider_service_id,
        "selected_provider": selected,
        "offers": _available_offers(db, service.id),
        "price": selected["price"] if selected else None,
        "booking_date": item.booking_date,
        "booking_time": item.booking_time,
        "service_address": item.service_address,
        "latitude": item.latitude,
        "longitude": item.longitude,
        "special_instructions": item.special_instructions,
    }


@router.get("/cart")
def get_cart(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    items = db.query(CartItem).filter(CartItem.user_id == current_user.id).order_by(CartItem.created_at.asc()).all()
    item_responses = [_cart_item_response(db, item) for item in items]
    has_unpriced_items = any(item["price"] is None for item in item_responses)
    subtotal = round(sum(float(item["price"] or 0) for item in item_responses), 2)
    return {
        "items": item_responses,
        "subtotal": subtotal,
        "price_quote_complete": not has_unpriced_items,
    }


@router.post("/cart/items", status_code=status.HTTP_201_CREATED)
def add_cart_item(
    request: CartItemCreate,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    service = db.query(Service).filter(Service.id == request.service_id, Service.is_active.is_(True)).first()
    if not service:
        raise HTTPException(status_code=404, detail="The selected service is not available.")
    if request.provider_service_id is not None:
        _eligible_offer(db, request.service_id, request.provider_service_id)

    cart_key = f"{request.service_id}:{request.provider_service_id or 'any'}"
    item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.cart_key == cart_key,
    ).first()
    created = item is None
    if created:
        item = CartItem(
            user_id=current_user.id,
            service_id=request.service_id,
            provider_service_id=request.provider_service_id,
            cart_key=cart_key,
        )
        db.add(item)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            item = db.query(CartItem).filter(
                CartItem.user_id == current_user.id,
                CartItem.cart_key == cart_key,
            ).first()
            if not item:
                raise HTTPException(status_code=409, detail="This service could not be added to your cart.")
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="The cart could not be saved.")
        if item:
            db.refresh(item)
    else:
        response.status_code = status.HTTP_200_OK
    return {"item": _cart_item_response(db, item), "created": created}


@router.put("/cart/items/{item_id}")
def update_cart_item(
    item_id: int,
    request: CartItemUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    item = db.query(CartItem).filter(
        CartItem.id == item_id,
        CartItem.user_id == current_user.id,
    ).with_for_update().first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found.")

    updates = request.model_dump(exclude_unset=True)
    provider_service_id = updates.get("provider_service_id", item.provider_service_id)
    if provider_service_id is not None:
        _eligible_offer(db, item.service_id, provider_service_id)
    booking_date = updates.get("booking_date", item.booking_date)
    booking_time = updates.get("booking_time", item.booking_time)
    if (booking_date is None) != (booking_time is None):
        raise HTTPException(status_code=422, detail="Select both a booking date and time.")
    if booking_date:
        if isinstance(booking_date, str):
            booking_date = datetime.strptime(booking_date, "%Y-%m-%d").date()
        if isinstance(booking_time, str):
            booking_time = time.fromisoformat(booking_time)
    if booking_date and datetime.combine(booking_date, booking_time) <= datetime.now():
        raise HTTPException(status_code=422, detail="Choose a booking time in the future.")

    new_key = f"{item.service_id}:{provider_service_id or 'any'}"
    duplicate = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.cart_key == new_key,
        CartItem.id != item.id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="This service and provider are already in your cart.")
    item.provider_service_id = provider_service_id
    item.cart_key = new_key
    for field in ("booking_date", "booking_time", "service_address", "latitude", "longitude", "special_instructions"):
        if field in updates:
            value = updates[field]
            if field == "booking_date" and value is not None:
                value = value.isoformat()
            elif field == "booking_time" and value is not None:
                value = value.isoformat(timespec="minutes")
            setattr(item, field, value)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="The cart item could not be saved.")
    db.refresh(item)
    return _cart_item_response(db, item)


@router.delete("/cart/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_cart_item(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    item = db.query(CartItem).filter(
        CartItem.id == item_id,
        CartItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found.")
    db.delete(item)
    db.commit()


def _resolve_address(address: str, latitude: Optional[float], longitude: Optional[float]) -> tuple[float, float]:
    if latitude is not None and longitude is not None:
        return latitude, longitude
    locations = geocode_location(address)
    if not locations:
        raise HTTPException(
            status_code=422,
            detail=f"Could not validate service address '{address}'. Select a recognized address or map location.",
        )
    return float(locations[0]["latitude"]), float(locations[0]["longitude"])


def _check_schedule(db: Session, provider: Provider, service: Service, requested_date, requested_time) -> None:
    rules = db.query(ProviderAvailability).filter(
        ProviderAvailability.provider_id == provider.id
    ).all()
    if rules:
        start = datetime.combine(requested_date, requested_time)
        end = start + timedelta(minutes=service.estimated_duration_minutes or 60)
        fits_schedule = False
        for rule in rules:
            if rule.day_of_week != requested_date.weekday() or not rule.is_available:
                continue
            try:
                start_time = time.fromisoformat(rule.start_time)
                end_time = time.fromisoformat(rule.end_time)
            except ValueError:
                continue
            if start_time <= start.time() and end.time() <= end_time:
                fits_schedule = True
                break
        if not fits_schedule:
            raise HTTPException(
                status_code=409,
                detail=f"{provider.business_name or provider.user.full_name} is unavailable on {requested_date.isoformat()} at {requested_time.isoformat(timespec='minutes')}.",
            )


def _check_slot_conflicts(
    db: Session,
    provider: Provider,
    service: Service,
    requested_date,
    requested_time,
    reserved_slots: dict[int, list[tuple[datetime, datetime]]],
) -> None:
    start = datetime.combine(requested_date, requested_time)
    end = start + timedelta(minutes=service.estimated_duration_minutes or 60)
    existing_bookings = db.query(Booking).filter(
        Booking.provider_id == provider.id,
        Booking.booking_date == requested_date.isoformat(),
        Booking.status.in_(ACTIVE_BOOKING_STATUSES),
    ).all()
    for booking in existing_bookings:
        existing_service = db.query(Service).filter(Service.id == booking.service_id).first()
        duration = existing_service.estimated_duration_minutes if existing_service else 60
        existing_start = datetime.combine(requested_date, time.fromisoformat(booking.booking_time))
        existing_end = existing_start + timedelta(minutes=duration or 60)
        if start < existing_end and existing_start < end:
            raise HTTPException(
                status_code=409,
                detail=f"{provider.business_name or provider.user.full_name} already has a booking that conflicts with {requested_time.isoformat(timespec='minutes')} on {requested_date.isoformat()}.",
            )
    for existing_start, existing_end in reserved_slots.get(provider.id, []):
        if start < existing_end and existing_start < end:
            raise HTTPException(
                status_code=409,
                detail=f"Two services in this order require overlapping times with {provider.business_name or provider.user.full_name}.",
            )
    reserved_slots.setdefault(provider.id, []).append((start, end))


def _order_response(order: ServiceOrder, db: Session) -> dict:
    bookings = db.query(Booking).filter(Booking.order_id == order.id).order_by(Booking.id.asc()).all()
    return {
        "id": order.id,
        "order_reference": order.order_reference,
        "status": order.status,
        "service_address": order.service_address,
        "total_amount": order.total_amount,
        "created_at": order.created_at.isoformat(),
        "items": [
            {
                "booking_id": booking.id,
                "booking_reference": booking.booking_reference,
                "service_id": booking.service_id,
                "service_name": booking.service.name,
                "provider_id": booking.provider_id,
                "provider_name": booking.provider.business_name or booking.provider.user.full_name,
                "booking_date": booking.booking_date,
                "booking_time": booking.booking_time,
                "service_address": booking.service_address,
                "price": booking.total_amount,
                "status": booking.status.value,
            }
            for booking in bookings
        ],
    }


@router.post("/orders/checkout", status_code=status.HTTP_201_CREATED)
def checkout(
    request: CheckoutRequest,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    if str(request.customer_email).casefold() != current_user.email.casefold():
        raise HTTPException(status_code=400, detail="Checkout email must match the signed-in customer account.")

    existing_order = db.query(ServiceOrder).filter(
        ServiceOrder.user_id == current_user.id,
        ServiceOrder.idempotency_key == request.idempotency_key,
    ).first()
    if existing_order:
        response.status_code = status.HTTP_200_OK
        return _order_response(existing_order, db)

    cart_items = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.id.in_(request.item_ids),
    ).order_by(CartItem.id.asc()).with_for_update().all()
    if len(cart_items) != len(request.item_ids):
        raise HTTPException(status_code=409, detail="One or more cart items are no longer in your cart. Refresh and retry.")

    resolved_addresses: list[tuple[str, float, float]] = []
    selected_offers: list[tuple[CartItem, ProviderService, Provider, Service, datetime, datetime]] = []
    reserved_slots: dict[int, list[tuple[datetime, datetime]]] = {}
    for item in cart_items:
        if not item.provider_service_id:
            raise HTTPException(
                status_code=409,
                detail=f"Choose a real provider for {item.service.name} before checkout.",
            )
        if not item.booking_date or not item.booking_time:
            raise HTTPException(
                status_code=422,
                detail=f"Select a date and time for {item.service.name} before checkout.",
            )
        service = db.query(Service).filter(
            Service.id == item.service_id,
            Service.is_active.is_(True),
        ).first()
        if not service:
            raise HTTPException(status_code=409, detail=f"{item.service.name} is no longer available.")
        offering = _eligible_offer(db, item.service_id, item.provider_service_id)
        provider = offering.provider
        try:
            requested_date = datetime.strptime(item.booking_date, "%Y-%m-%d").date()
            requested_time = time.fromisoformat(item.booking_time)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid appointment for {service.name}.") from exc
        if datetime.combine(requested_date, requested_time) <= datetime.now():
            raise HTTPException(status_code=422, detail=f"Choose a future appointment for {service.name}.")

        address = (item.service_address or request.service_address).strip()
        if item.service_address:
            latitude, longitude = item.latitude, item.longitude
        else:
            latitude, longitude = request.latitude, request.longitude
        if (latitude is None) != (longitude is None):
            raise HTTPException(status_code=422, detail=f"Choose both map coordinates for {service.name}.")
        latitude, longitude = _resolve_address(address, latitude, longitude)
        offer_latitude = offering.service_latitude if offering.service_latitude is not None else provider.latitude
        offer_longitude = offering.service_longitude if offering.service_longitude is not None else provider.longitude
        if offer_latitude is None or offer_longitude is None:
            raise HTTPException(status_code=409, detail=f"{provider.business_name or provider.user.full_name} has no saved coverage location for {service.name}.")
        distance = haversine_distance(latitude, longitude, offer_latitude, offer_longitude)
        if distance > offering.service_radius_km:
            raise HTTPException(
                status_code=409,
                detail=f"{provider.business_name or provider.user.full_name} does not cover the address for {service.name} ({distance:.1f} km away; coverage is {offering.service_radius_km:g} km).",
            )
        _check_schedule(db, provider, service, requested_date, requested_time)
        _check_slot_conflicts(db, provider, service, requested_date, requested_time, reserved_slots)
        start = datetime.combine(requested_date, requested_time)
        end = start + timedelta(minutes=service.estimated_duration_minutes or 60)
        selected_offers.append((item, offering, provider, service, start, end))
        resolved_addresses.append((address, latitude, longitude))

    if len(request.customer_full_name.strip()) < 2:
        raise HTTPException(status_code=422, detail="Enter the customer's full name.")

    order_address = request.service_address.strip()
    order_latitude, order_longitude = _resolve_address(order_address, request.latitude, request.longitude)
    total_amount = round(sum(float(offering.custom_price) for _, offering, _, _, _, _ in selected_offers), 2)
    order = ServiceOrder(
        order_reference=f"ORD-{uuid.uuid4().hex[:12].upper()}",
        idempotency_key=request.idempotency_key,
        user_id=current_user.id,
        service_address=order_address,
        latitude=order_latitude,
        longitude=order_longitude,
        total_amount=total_amount,
        status="PENDING",
    )
    db.add(order)
    try:
        db.flush()
        for (item, offering, provider, service, start, _end), (address, latitude, longitude) in zip(
            selected_offers, resolved_addresses
        ):
            db.add(Booking(
                booking_reference=f"BK-{uuid.uuid4().hex[:10].upper()}",
                user_id=current_user.id,
                provider_id=provider.id,
                provider_service_id=offering.id,
                service_id=service.id,
                order_id=order.id,
                booking_date=start.date().isoformat(),
                booking_time=start.time().isoformat(timespec="minutes"),
                status=BookingStatus.PENDING,
                total_amount=float(offering.custom_price),
                service_address=address,
                latitude=latitude,
                longitude=longitude,
                special_instructions=item.special_instructions,
            ))
            db.delete(item)
        current_user.full_name = request.customer_full_name.strip()
        digits = "".join(character for character in request.customer_mobile if character.isdigit())
        current_user.phone = f"+{digits}" if request.customer_mobile.strip().startswith("+") else digits
        db.commit()
        db.refresh(order)
    except IntegrityError:
        db.rollback()
        duplicate_order = db.query(ServiceOrder).filter(
            ServiceOrder.user_id == current_user.id,
            ServiceOrder.idempotency_key == request.idempotency_key,
        ).first()
        if duplicate_order:
            response.status_code = status.HTTP_200_OK
            return _order_response(duplicate_order, db)
        raise HTTPException(status_code=409, detail="The order could not be confirmed because a booking conflict occurred. Your cart is unchanged.")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Checkout failed; no order was created and your cart is unchanged.")
    return _order_response(order, db)


@router.get("/orders")
def list_orders(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    orders = db.query(ServiceOrder).filter(
        ServiceOrder.user_id == current_user.id
    ).order_by(ServiceOrder.created_at.desc()).all()
    return [_order_response(order, db) for order in orders]


@router.get("/orders/{order_id}")
def get_order(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    _require_customer(current_user)
    order = db.query(ServiceOrder).filter(
        ServiceOrder.id == order_id,
        ServiceOrder.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return _order_response(order, db)
