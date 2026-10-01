from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.provider import Provider
from app.models.provider_service import ProviderService
from app.models.service import Service
from app.models.user import User
from app.utils.geo import haversine_distance, geocode_location, suggest_locations, relocate_providers_around

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
            Provider.latitude.isnot(None),
            Provider.longitude.isnot(None),
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
        # Avoid duplicate provider cards when no service filter is passed
        if not service_id and provider.id in seen_providers:
            continue
        seen_providers.add(provider.id)

        dist = haversine_distance(latitude, longitude, provider.latitude, provider.longitude)
        if dist <= radius_km:
            user = db.query(User).filter(User.id == provider.user_id).first()
            svc = db.query(Service).filter(Service.id == ps.service_id).first()
            svc_name = ps.custom_service_name or (svc.name if svc else "General Service")

            nearby.append({
                "provider_id": provider.id,
                "provider_service_id": ps.id,
                "provider_name": provider.business_name or (user.full_name if user else "Provider"),
                "service": svc_name,
                "service_id": ps.service_id,
                "latitude": float(provider.latitude),
                "longitude": float(provider.longitude),
                "distance": round(dist, 2),
                "rating": float(provider.rating_avg or 4.8),
                "total_ratings": int(provider.total_ratings or 15),
                "availability": "Available Today" if provider.is_available else "Busy",
                "price": float(ps.custom_price or (svc.base_price if svc else 500.0)),
                "address": provider.address or "Verified Service Center"
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
    """
    Relocate verified providers to surround any specified GPS coordinates (1.2 km to 8.5 km),
    enabling live demonstration and validation from any physical location or college campus.
    """
    updated_count = relocate_providers_around(db, latitude, longitude, area_name)
    return {
        "message": f"Successfully relocated {updated_count} providers around ({latitude}, {longitude})",
        "target_latitude": latitude,
        "target_longitude": longitude,
        "updated": updated_count
    }


@router.post("/reset-bengaluru-providers")
@router.post("/reset-bengaluru-providers/")
def reset_bengaluru_providers(db: Session = Depends(get_db)):
    """Reset provider coordinates back to standard Bengaluru locations."""
    bengaluru_coords = [
        (12.9116, 77.6389, "HSR Layout, Bengaluru"),
        (12.9352, 77.6245, "Koramangala, Bengaluru"),
        (12.9784, 77.6408, "Indiranagar, Bengaluru"),
        (12.9250, 77.5938, "Jayanagar, Bengaluru"),
        (12.9165, 77.6101, "BTM Layout, Bengaluru"),
    ]
    providers = db.query(Provider).all()
    for idx, p in enumerate(providers):
        lat, lon, addr = bengaluru_coords[idx % len(bengaluru_coords)]
        p.latitude = lat
        p.longitude = lon
        p.address = addr
    db.commit()
    return {"message": "Providers reset to Bengaluru locations", "updated": len(providers)}
