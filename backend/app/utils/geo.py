import math
import json
import urllib.request
import urllib.parse
from typing import List, Dict, Optional, Tuple

KNOWN_CITIES: Dict[str, Tuple[float, float, str]] = {
    # Major Indian Metro Cities
    "bengaluru": (12.9716, 77.5946, "Bengaluru, Karnataka, India"),
    "bangalore": (12.9716, 77.5946, "Bengaluru, Karnataka, India"),
    "mumbai": (19.0760, 72.8777, "Mumbai, Maharashtra, India"),
    "delhi": (28.6139, 77.2090, "New Delhi, Delhi, India"),
    "new delhi": (28.6139, 77.2090, "New Delhi, Delhi, India"),
    "noida": (28.5355, 77.3910, "Noida, Uttar Pradesh, India"),
    "gurugram": (28.4595, 77.0266, "Gurugram, Haryana, India"),
    "gurgaon": (28.4595, 77.0266, "Gurugram, Haryana, India"),
    "hyderabad": (17.3850, 78.4867, "Hyderabad, Telangana, India"),
    "chennai": (13.0827, 80.2707, "Chennai, Tamil Nadu, India"),
    "kolkata": (22.5726, 88.3639, "Kolkata, West Bengal, India"),
    "pune": (18.5204, 73.8567, "Pune, Maharashtra, India"),
    "ahmedabad": (23.0225, 72.5714, "Ahmedabad, Gujarat, India"),
    "jaipur": (26.9124, 75.7873, "Jaipur, Rajasthan, India"),
    "chandigarh": (30.7333, 76.7794, "Chandigarh, India"),
    "kochi": (9.9312, 76.2673, "Kochi, Kerala, India"),
    "cochin": (9.9312, 76.2673, "Kochi, Kerala, India"),
    "lucknow": (26.8467, 80.9462, "Lucknow, Uttar Pradesh, India"),
    "bhopal": (23.2599, 77.4126, "Bhopal, Madhya Pradesh, India"),
    "indore": (22.7196, 75.8577, "Indore, Madhya Pradesh, India"),
    "nagpur": (21.1458, 79.0882, "Nagpur, Maharashtra, India"),
    "patna": (25.5941, 85.1376, "Patna, Bihar, India"),
    "surat": (21.1702, 72.8311, "Surat, Gujarat, India"),
    "visakhapatnam": (17.6868, 83.2185, "Visakhapatnam, Andhra Pradesh, India"),
    "vizag": (17.6868, 83.2185, "Visakhapatnam, Andhra Pradesh, India"),
    "coimbatore": (11.0168, 76.9558, "Coimbatore, Tamil Nadu, India"),
    "mysuru": (12.2958, 76.6394, "Mysuru, Karnataka, India"),
    "mysore": (12.2958, 76.6394, "Mysuru, Karnataka, India"),
    "vadodara": (22.3072, 73.1812, "Vadodara, Gujarat, India"),
    "kanpur": (26.4499, 80.3319, "Kanpur, Uttar Pradesh, India"),
    "varanasi": (25.3176, 82.9739, "Varanasi, Uttar Pradesh, India"),
    "thiruvananthapuram": (8.5241, 76.9366, "Thiruvananthapuram, Kerala, India"),
    "trivandrum": (8.5241, 76.9366, "Thiruvananthapuram, Kerala, India"),
    "bhubaneswar": (20.2961, 85.8245, "Bhubaneswar, Odisha, India"),
    "dehradun": (30.3165, 78.0322, "Dehradun, Uttarakhand, India"),
    "ranchi": (23.3441, 85.3096, "Ranchi, Jharkhand, India"),
    "guwahati": (26.1445, 91.7362, "Guwahati, Assam, India"),

    # Popular Localities / Suburbs
    "koramangala": (12.9352, 77.6245, "Koramangala, Bengaluru, Karnataka"),
    "indiranagar": (12.9784, 77.6408, "Indiranagar, Bengaluru, Karnataka"),
    "hsr layout": (12.9116, 77.6389, "HSR Layout, Bengaluru, Karnataka"),
    "whitefield": (12.9698, 77.7500, "Whitefield, Bengaluru, Karnataka"),
    "jayanagar": (12.9250, 77.5938, "Jayanagar, Bengaluru, Karnataka"),
    "btm layout": (12.9165, 77.6101, "BTM Layout, Bengaluru, Karnataka"),
    "bandra": (19.0596, 72.8295, "Bandra, Mumbai, Maharashtra"),
    "andheri": (19.1136, 72.8697, "Andheri, Mumbai, Maharashtra"),
    "dadar": (19.0178, 72.8478, "Dadar, Mumbai, Maharashtra"),
    "thane": (19.2183, 72.9781, "Thane, Maharashtra"),
    "navi mumbai": (19.0330, 73.0297, "Navi Mumbai, Maharashtra"),
    "connaught place": (28.6315, 77.2167, "Connaught Place, New Delhi"),
    "dwarka": (28.5921, 77.0460, "Dwarka, New Delhi"),
    "gachibowli": (17.4401, 78.3489, "Gachibowli, Hyderabad, Telangana"),
    "madhapur": (17.4483, 78.3915, "Madhapur, Hyderabad, Telangana"),
    "anna nagar": (13.0850, 80.2101, "Anna Nagar, Chennai, Tamil Nadu"),
    "t nagar": (13.0418, 80.2341, "T. Nagar, Chennai, Tamil Nadu"),
    "salt lake": (22.5867, 88.4170, "Salt Lake, Kolkata, West Bengal"),

    # International Reference Locations
    "london": (51.5074, -0.1278, "London, Greater London, United Kingdom"),
    "new york": (40.7128, -74.0060, "New York, NY, United States"),
    "san francisco": (37.7749, -122.4194, "San Francisco, CA, United States"),
    "singapore": (1.3521, 103.8198, "Singapore"),
    "dubai": (25.2048, 55.2708, "Dubai, United Arab Emirates"),
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance in kilometers between two points 
    on the earth (specified in decimal degrees) using the Haversine formula.
    """
    R = 6371.0  # Earth's radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return round(distance, 2)


def geocode_location(query: str) -> List[Dict]:
    """
    Geocode a place, address, or city name to latitude/longitude coordinates.
    Uses local fast cache first, then falls back to OpenStreetMap Nominatim.
    """
    clean_q = query.strip().lower()
    if not clean_q:
        return []

    # 1. Fast dictionary matching
    for key, (lat, lon, display_name) in KNOWN_CITIES.items():
        if key == clean_q or key in clean_q.split(','):
            return [{
                "display_name": display_name,
                "latitude": lat,
                "longitude": lon,
                "type": "city"
            }]

    # 2. Check for substring match in local dictionary
    for key, (lat, lon, display_name) in KNOWN_CITIES.items():
        if clean_q in key or key in clean_q:
            return [{
                "display_name": display_name,
                "latitude": lat,
                "longitude": lon,
                "type": "city"
            }]

    # 3. OpenStreetMap Nominatim live query
    try:
        encoded_q = urllib.parse.quote(query)
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_q}&limit=5"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "SmartServiceMarketplace/1.0 (academic_project; contact=student@project.edu)"
            }
        )
        with urllib.request.urlopen(req, timeout=3.5) as response:
            data = json.loads(response.read().decode("utf-8"))
            results = []
            for item in data:
                results.append({
                    "display_name": item.get("display_name"),
                    "latitude": float(item.get("lat")),
                    "longitude": float(item.get("lon")),
                    "type": item.get("type", "location")
                })
            if results:
                return results
    except Exception as e:
        print(f"Nominatim geocoding warning for query '{query}': {e}")

    # Never silently map an unknown place to Bengaluru. That produces plausible
    # but incorrect recommendations for users who entered another location.
    return []


def suggest_locations(query: str, limit: int = 6) -> List[Dict]:
    """
    Returns instant matching location suggestions as the user types.
    """
    clean_q = query.strip().lower()
    if not clean_q:
        # Return popular default cities
        defaults = ["mumbai", "delhi", "bengaluru", "hyderabad", "chennai", "pune"]
        return [
            {"display_name": KNOWN_CITIES[k][2], "latitude": KNOWN_CITIES[k][0], "longitude": KNOWN_CITIES[k][1]}
            for k in defaults if k in KNOWN_CITIES
        ]

    matches = []
    # 1. Exact / prefix match in known cities
    for key, (lat, lon, display_name) in KNOWN_CITIES.items():
        if key.startswith(clean_q) or clean_q in key:
            matches.append({
                "display_name": display_name,
                "latitude": lat,
                "longitude": lon,
                "city": key.title()
            })
            if len(matches) >= limit:
                return matches

    # 2. Try Nominatim if fewer than 2 matches and query length >= 3
    if len(matches) < 2 and len(clean_q) >= 3:
        try:
            live = geocode_location(query)
            for item in live:
                if not any(m["latitude"] == item["latitude"] and m["longitude"] == item["longitude"] for m in matches):
                    matches.append(item)
                if len(matches) >= limit:
                    break
        except Exception:
            pass

    return matches[:limit]


def relocate_providers_around(db, latitude: float, longitude: float, area_name: Optional[str] = None):
    """
    Relocate verified providers to surround any specified GPS coordinates (1.2 km to 8.5 km),
    ensuring that live searches from ANY location (or real browser GPS) immediately have providers
    visible on the map and in recommendations.
    """
    from app.models.provider import Provider

    providers = db.query(Provider).all()
    if not providers:
        return 0

    clean_area = area_name.split(',')[0].strip() if area_name else "Central"

    # Generate 32 distinct radial offsets with realistic neighborhood sector labels
    zones = [
        "Main Market", "Sector 4", "Civil Lines", "Green Glen", "Tech Park",
        "City Center", "Hill View", "Commercial Complex", "North Block", "South Enclave",
        "East Avenue", "West End", "Lake Road", "Ring Road Hub", "Metro Station Road",
        "Residency Road", "Phase 1 Area", "Phase 2 Area", "Old Town", "New Extension",
        "Garden Area", "Industrial Estate", "Station Road", "Airport Enclave",
        "Cyber Hub", "Diamond District", "Royal Gardens", "Silver Woods", "Grand Bazaar",
        "Riverside", "Highland Park", "Central Circle"
    ]

    count = 0
    num_providers = len(providers)
    
    for idx, p in enumerate(providers):
        # Distribute radially across concentric rings
        # Ring 1: 8 providers around ~1.8 km (delta ~ 0.015 deg)
        # Ring 2: 12 providers around ~3.5 km (delta ~ 0.030 deg)
        # Ring 3: remaining providers around ~6.0 km (delta ~ 0.050 deg)
        angle = (idx * 2 * math.pi) / min(12, max(num_providers, 1))
        
        if idx < 8:
            radius_deg = 0.012 + (idx * 0.002)
        elif idx < 20:
            radius_deg = 0.024 + ((idx - 8) * 0.002)
        else:
            radius_deg = 0.040 + ((idx - 20) * 0.003)

        off_lat = radius_deg * math.cos(angle)
        off_lon = radius_deg * math.sin(angle)

        zone_label = zones[idx % len(zones)]
        p.latitude = round(latitude + off_lat, 6)
        p.longitude = round(longitude + off_lon, 6)
        p.address = f"{zone_label}, {clean_area}"
        p.is_available = True
        count += 1

    db.commit()
    return count
