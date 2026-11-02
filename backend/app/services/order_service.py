from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.service_order import ServiceOrder


def refresh_order_status(db: Session, order_id: int | None) -> None:
    if order_id is None:
        return
    db.flush()
    order = db.query(ServiceOrder).filter(ServiceOrder.id == order_id).first()
    if not order:
        return
    statuses = [
        row[0] for row in db.query(Booking.status).filter(Booking.order_id == order_id).all()
    ]
    if not statuses:
        return
    if all(value == BookingStatus.CANCELLED for value in statuses):
        order.status = "CANCELLED"
    elif any(value == BookingStatus.CANCELLED for value in statuses):
        order.status = "PARTIALLY_CANCELLED"
    elif all(value == BookingStatus.COMPLETED for value in statuses):
        order.status = "COMPLETED"
    elif any(value == BookingStatus.IN_PROGRESS for value in statuses):
        order.status = "IN_PROGRESS"
    elif any(value == BookingStatus.ACCEPTED for value in statuses):
        order.status = "ACCEPTED"
    else:
        order.status = "PENDING"
