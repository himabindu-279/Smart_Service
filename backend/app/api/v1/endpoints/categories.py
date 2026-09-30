from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.category import Category
from app.models.service import Service
from app.models.provider_service import ProviderService
from app.models.enums import ServiceApprovalStatus

router = APIRouter()


@router.get("")
@router.get("/")
def get_categories_with_services(
    only_active_providers: bool = Query(False, description="Only return services offered by approved active providers"),
    db: Session = Depends(get_db)
):
    """
    Retrieve all categories and their corresponding sub-services.
    If only_active_providers=True, only includes services with approved providers.
    """
    categories = db.query(Category).filter(Category.is_active == True).all()
    results = []
    
    for cat in categories:
        services_q = db.query(Service).filter(Service.category_id == cat.id, Service.is_active == True)
        services = services_q.all()
        matched_services = []

        for s in services:
            # Check if any approved active provider offers this service
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

            matched_services.append({
                "id": s.id,
                "name": s.name,
                "slug": s.slug,
                "description": s.description,
                "base_price": s.base_price,
                "estimated_duration_minutes": s.estimated_duration_minutes,
                "active_providers_count": provider_count
            })

        if only_active_providers and not matched_services:
            continue

        results.append({
            "id": cat.id,
            "name": cat.name,
            "slug": cat.slug,
            "description": cat.description,
            "icon": cat.icon,
            "services": matched_services
        })

    return results
