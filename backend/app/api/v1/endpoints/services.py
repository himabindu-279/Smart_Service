from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.service import Service
from app.models.category import Category
from app.models.provider_service import ProviderService
from app.models.enums import ServiceApprovalStatus

router = APIRouter()


@router.get("")
@router.get("/")
def get_services(
    category_id: Optional[int] = None,
    only_active_providers: bool = Query(False, description="Only return services with approved providers"),
    db: Session = Depends(get_db)
):
    """Retrieve all services, optionally filtered by category and active provider availability."""
    query = db.query(Service).filter(Service.is_active == True)
    if category_id:
        query = query.filter(Service.category_id == category_id)

    services = query.all()
    results = []

    for s in services:
        provider_count = (
            db.query(ProviderService)
            .filter(
                ProviderService.service_id == s.id,
                ProviderService.is_active == True,
                ProviderService.status == ServiceApprovalStatus.APPROVED
            )
            .count()
        )

        if only_active_providers and provider_count == 0:
            continue

        results.append({
            "id": s.id,
            "category_id": s.category_id,
            "category_name": s.category.name if s.category else None,
            "name": s.name,
            "slug": s.slug,
            "description": s.description,
            "base_price": s.base_price,
            "estimated_duration_minutes": s.estimated_duration_minutes,
            "active_providers_count": provider_count
        })

    return results


@router.get("/{service_id}")
def get_service_detail(service_id: int, db: Session = Depends(get_db)):
    """Retrieve details for a single service."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    provider_count = (
        db.query(ProviderService)
        .filter(
            ProviderService.service_id == service.id,
            ProviderService.is_active == True,
            ProviderService.status == ServiceApprovalStatus.APPROVED
        )
        .count()
    )

    return {
        "id": service.id,
        "category_id": service.category_id,
        "category_name": service.category.name if service.category else None,
        "name": service.name,
        "slug": service.slug,
        "description": service.description,
        "base_price": service.base_price,
        "estimated_duration_minutes": service.estimated_duration_minutes,
        "active_providers_count": provider_count
    }
