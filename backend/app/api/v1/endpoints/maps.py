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


@router.get("/nearby")
@router.get("/nearby/")
def get_nearby_providers(
    latitude: float = Query(..., description="User latitude"),
    longitude: float = Query(..., description="User longitude"),
    service_id: Optional[int] = Query(None, description="Filter by service ID"),
    radius_km: float = Query(15.0, description="Search radius in kilometers"),
    auto_locate: bool = Query(True, description="Automatically ensure providers are available in any searched location"),
    db: Session = Depends(get_db)
):
    """
    Search nearby providers offering a specific service within a given radius using Haversine distance.
    Returns: provider name, provider ID, service_id, latitude, longitude, distance, rating, availability, price.
    If no providers exist near this location, automatically positions verified providers around the coordinates
    so that ANY city or address searched works seamlessly.
    """
    def _fetch_nearby():
        query = db.query(Provider).filter(
            Provider.is_available == True,
            Provider.latitude.isnot(None),
            Provider.longitude.isnot(None)
        )

        if service_id:
            query = query.join(ProviderService).filter(
                ProviderService.service_id == service_id,
                ProviderService.is_active == True
            )

        providers = query.all()
        nearby = []

        for p in providers:
            dist = haversine_distance(latitude, longitude, p.latitude, p.longitude)
            if dist <= radius_km:
                user = db.query(User).filter(User.id == p.user_id).first()
                
                price = 500.0
                service_name = "General Service"
                active_service_id = service_id
                if service_id:
                    ps = db.query(ProviderService).filter(
                        ProviderService.provider_id == p.id,
                        ProviderService.service_id == service_id
                    ).first()
                    if ps:
                        price = ps.custom_price
                    svc = db.query(Service).filter(Service.id == service_id).first()
                    if svc:
                        service_name = svc.name
                else:
                    first_ps = db.query(ProviderService).filter(ProviderService.provider_id == p.id).first()
                    if first_ps:
                        price = first_ps.custom_price
                        active_service_id = first_ps.service_id
                        svc = db.query(Service).filter(Service.id == first_ps.service_id).first()
                        if svc:
                            service_name = svc.name
                    else:
                        first_svc = db.query(Service).first()
                        active_service_id = first_svc.id if first_svc else 1

                nearby.append({
                    "provider_id": p.id,
                    "provider_name": p.business_name or (user.full_name if user else "Provider"),
                    "service": service_name,
                    "service_id": active_service_id,
                    "latitude": p.latitude,
                    "longitude": p.longitude,
                    "distance": dist,
                    "rating": p.rating_avg or 4.8,
                    "total_ratings": p.total_ratings or 15,
                    "availability": "Available Today" if p.is_available else "Busy",
                    "price": price,
                    "address": p.address or "Verified Service Center"
                })

        nearby.sort(key=lambda x: x["distance"])
        return nearby

    results = _fetch_nearby()

    # If no providers or very few exist in this region and auto_locate is True, relocate providers around this location
    if len(results) < 2 and auto_locate:
        relocate_providers_around(db, latitude, longitude)
        results = _fetch_nearby()

    return results


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
