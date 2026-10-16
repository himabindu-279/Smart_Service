from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.category import Category
from app.models.service import Service
from app.models.provider_service import ProviderService
from app.models.provider import Provider
from app.models.user import User
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
    service_counts = dict(
        db.query(Service.id, func.count(ProviderService.id))
        .outerjoin(
            ProviderService,
            (ProviderService.service_id == Service.id)
            & (ProviderService.is_active == True)
            & (ProviderService.status == ServiceApprovalStatus.APPROVED),
        )
        .outerjoin(Provider, Provider.id == ProviderService.provider_id)
        .outerjoin(User, User.id == Provider.user_id)
        .filter(
            Service.is_active == True,
            (ProviderService.id == None)
            | ((Provider.is_available == True) & (User.is_active == True)),
        )
        .group_by(Service.id)
        .all()
    )
    services = db.query(Service).filter(Service.is_active == True).all()
    services_by_category = {}

    for service in services:
        provider_count = service_counts.get(service.id, 0)
        if only_active_providers and provider_count == 0:
            continue

        services_by_category.setdefault(service.category_id, []).append({
            "id": service.id,
            "name": service.name,
            "slug": service.slug,
            "description": service.description,
            "base_price": service.base_price,
            "estimated_duration_minutes": service.estimated_duration_minutes,
            "active_providers_count": provider_count,
        })

    results = [
        {
            "id": category.id,
            "name": category.name,
            "slug": category.slug,
            "description": category.description,
            "icon": category.icon,
            "services": services_by_category.get(category.id, []),
        }
        for category in categories
        if not only_active_providers or services_by_category.get(category.id)
    ]

    return results
