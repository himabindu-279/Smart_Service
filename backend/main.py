from contextlib import asynccontextmanager
import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.api.v1.api import api_router
from app.services.email_service import process_due_booking_emails
from app.services.notification_service import process_due_sms_notifications

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize tables and seed initial administrator/categories
    logger.info("Starting AI-Driven Smart Service Marketplace backend...")
    db = SessionLocal()
    try:
        init_db(db)
    except Exception:
        logger.exception("Database initialization failed.")
        raise
    finally:
        db.close()
    email_worker = asyncio.create_task(_booking_email_worker())
    sms_worker = asyncio.create_task(_sms_notification_worker())
    yield
    email_worker.cancel()
    sms_worker.cancel()
    try:
        await email_worker
    except asyncio.CancelledError:
        pass
    try:
        await sms_worker
    except asyncio.CancelledError:
        pass
    # Shutdown
    logger.info("Shutting down backend...")


async def _booking_email_worker():
    while True:
        try:
            await asyncio.to_thread(process_due_booking_emails)
        except SQLAlchemyError:
            logger.exception("Booking email outbox polling failed.")
        await asyncio.sleep(max(5, settings.EMAIL_OUTBOX_POLL_SECONDS))


async def _sms_notification_worker():
    while True:
        try:
            await asyncio.to_thread(process_due_sms_notifications)
        except SQLAlchemyError:
            logger.exception("SMS notification outbox polling failed.")
        await asyncio.sleep(max(5, settings.SMS_OUTBOX_POLL_SECONDS))


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API v1 endpoints
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": "1.0.0",
        "phase": "Phase 1 - Backend & Database Infrastructure",
        "status": "online",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "api_v1_url": settings.API_V1_STR,
        "health_check": f"{settings.API_V1_STR}/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
