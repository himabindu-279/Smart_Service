from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.provider import Provider
from app.models.provider_service import ProviderService
from app.models.service import Service
from app.models.user import User
from app.utils.geo import haversine_distance, geocode_location, suggest_locations
from app.api.deps import require_admin

router = APIRouter()


@router.get("/geocode")
@router.get("/geocode/")
def geocode_location_endpoint(
    query: str = Query(..., description="Location name, city, or address to geocode")
):
    """
    Geocode any city, area, or address into coordinates using fast cache and OpenStreetMap Nominatim.
    """
    results = geocode_location(query)
    return results


@router.get("/search-suggestions")
@router.get("/search-suggestions/")
def get_search_suggestions(
    query: str = Query("", description="Query for location autocomplete"),
    limit: int = Query(6, description="Max suggestions to return")
):
    """
    Instant location autocomplete suggestions as the user types.
    """
    return suggest_locations(query, limit=limit)


from app.models.enums import ServiceApprovalStatus


@router.get("/nearby")
@router.get("/nearby/")
def get_nearby_providers(
    latitude: float = Query(..., description="User latitude"),
    longitude: float = Query(..., description="User longitude"),
    service_id: Optional[int] = Query(None, description="Filter by service ID"),
    radius_km: float = Query(15.0, description="Search radius in kilometers"),
    db: Session = Depends(get_db)
):
    """
    Search nearby providers offering approved and active services within radius_km using Haversine distance.
    Returns: provider name, provider ID, service_id, latitude, longitude, distance, rating, availability, price.
    Uses real PostgreSQL/database coordinates with zero artificial shifts.
    """
    query = (
        db.query(Provider, ProviderService)
        .join(ProviderService, Provider.id == ProviderService.provider_id)
        .join(User, Provider.user_id == User.id)
        .filter(
            User.is_active == True,
            Provider.is_available == True,
            Provider.verification_status == "APPROVED",
            ProviderService.is_active == True,
            ProviderService.status == ServiceApprovalStatus.APPROVED
        )
    )


    if service_id:
        query = query.filter(ProviderService.service_id == service_id)

    pairs = query.all()
    nearby = []
    seen_providers = set()

    for provider, ps in pairs:
        if not service_id and provider.id in seen_providers:
            continue

        service_latitude = ps.service_latitude if ps.service_latitude is not None else provider.latitude
        service_longitude = ps.service_longitude if ps.service_longitude is not None else provider.longitude
        if service_latitude is None or service_longitude is None:
            continue
        dist = haversine_distance(latitude, longitude, service_latitude, service_longitude)
        if dist > min(radius_km, ps.service_radius_km):
            continue
        user = db.query(User).filter(User.id == provider.user_id).first()
        svc = db.query(Service).filter(Service.id == ps.service_id).first()
        seen_providers.add(provider.id)
        nearby.append({
            "provider_id": provider.id,
            "provider_service_id": ps.id,
            "provider_name": provider.business_name or (user.full_name if user else "Provider"),
            "service": ps.custom_service_name or (svc.name if svc else "Service"),
            "service_id": ps.service_id,
            "latitude": float(service_latitude),
            "longitude": float(service_longitude),
            "distance": round(dist, 2),
            "rating": float(provider.rating_avg),
            "total_ratings": int(provider.total_ratings),
            "availability": ps.availability_hours,
            "price": float(ps.custom_price),
            "address": ps.service_location or provider.address
        })

    nearby.sort(key=lambda x: x["distance"])
    return nearby



@router.post("/sync-demo-providers")
@router.post("/sync-demo-providers/")
def sync_demo_providers_near_location(
    latitude: float = Query(..., description="Target latitude"),
    longitude: float = Query(..., description="Target longitude"),
    area_name: Optional[str] = Query(None, description="Optional area or city name"),
    db: Session = Depends(get_db)
):
    """Deprecated: provider coordinates are real data and must not be relocated."""
    return {
        "message": "Provider coordinates are fixed to their registered service locations.",
        "target_latitude": latitude,
        "target_longitude": longitude,
        "updated": 0
    }


@router.post("/reset-bengaluru-providers")
@router.post("/reset-bengaluru-providers/")
def reset_bengaluru_providers(
    db: Session = Depends(get_db),
    _current_admin: User = Depends(require_admin),
):
    """Retain the legacy URL without changing verified provider location data."""
    return {"message": "Location reset is disabled; update the provider's saved map pin instead.", "updated": 0}
