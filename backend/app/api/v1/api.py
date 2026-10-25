from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    users,
    health,
    categories,
    services,
    providers,
    maps,
    bookings,
    reviews,
    ai,
    admin,
    assistant,
    chat,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(services.router, prefix="/services", tags=["Services"])
api_router.include_router(providers.router, prefix="/providers", tags=["Providers"])
api_router.include_router(maps.router, prefix="/maps", tags=["Maps & Location"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["Reviews & Ratings"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI & Recommendations"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["AI Assistant"])
api_router.include_router(chat.router, prefix="/chat", tags=["Persistent Chat"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin Operations"])
