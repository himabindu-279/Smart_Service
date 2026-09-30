from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db, engine

router = APIRouter()


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Check API and database health status."""
    db_status = "healthy"
    db_type = engine.name
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "online",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "engine": db_type,
            "status": db_status
        },
        "phase": "Phase 1 - Core Backend & Database Infrastructure"
    }
