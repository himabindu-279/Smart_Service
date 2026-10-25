# Import all the models, so that Base has them before being
# imported by Alembic or database initialization
from app.db.base_class import Base
from app.models import (
    User,
    Provider,
    Category,
    Service,
    ProviderService,
    ProviderAvailability,
    Location,
    Booking,
    Review,
    Rating,
    Recommendation,
    ChatConversation,
    ChatMessage,
)
