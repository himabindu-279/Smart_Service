import pytest
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from main import app
from app.db.session import SessionLocal
from app.db.init_db import init_db

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Ensure database tables and seeds exist before tests."""
    db = SessionLocal()
    init_db(db)
    db.close()


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "docs_url" in data


def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "database" in data
    assert data["database"]["status"] == "healthy"


def test_register_regular_user():
    import uuid
    unique_email = f"testuser_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "email": unique_email,
        "password": "Password123!",
        "full_name": "Test User",
        "phone": "+91-9988776655",
        "role": "USER"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == unique_email
    assert data["user"]["role"] == "USER"


def test_register_provider_user():
    import uuid
    unique_email = f"testprovider_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "email": unique_email,
        "password": "ProviderPass123!",
        "full_name": "Suresh Electrician",
        "phone": "+91-9871122334",
        "role": "PROVIDER",
        "business_name": "Suresh Electrical Works",
        "bio": "Experienced certified electrician in home wiring and repairs.",
        "experience_years": 6,
        "address": "BTM Layout 2nd Stage, Bengaluru",
        "latitude": 12.9165,
        "longitude": 77.6101
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "PROVIDER"
    assert data["user"]["provider_id"] is not None


def test_login_success_and_get_me():
    # Login with seeded demo user
    login_payload = {
        "email": "user@marketplace.com",
        "password": "UserPassword123!"
    }
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 200
    token_data = response.json()
    token = token_data["access_token"]
    assert token is not None

    # Call /api/users/me
    headers = {"Authorization": f"Bearer {token}"}
    me_response = client.get("/api/users/me", headers=headers)
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["email"] == "user@marketplace.com"
    assert me_data["role"] == "USER"


def test_customer_can_update_profile_and_primary_location():
    import uuid

    email = f"location_user_{uuid.uuid4().hex[:8]}@example.com"
    registration = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Location User",
        "role": "USER",
    })
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    profile_response = client.put("/api/users/me", json={
        "full_name": "Updated Location User",
        "phone": "+91-9876543210",
    }, headers=headers)
    assert profile_response.status_code == 200
    assert profile_response.json()["full_name"] == "Updated Location User"

    location_payload = {
        "title": "Home",
        "address_line": "Koramangala, Bengaluru, Karnataka",
        "city": "Bengaluru",
        "state": "Karnataka",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "is_primary": True,
    }
    save_response = client.put("/api/users/me/location", json=location_payload, headers=headers)
    assert save_response.status_code == 200
    assert save_response.json()["is_primary"] is True

    read_response = client.get("/api/users/me/location", headers=headers)
    assert read_response.status_code == 200
    assert read_response.json()["address_line"] == location_payload["address_line"]


def test_recommendations_respect_selected_location_radius():
    response = client.post("/api/ai/recommend", json={
        "service_id": 1,
        "query": "air conditioner not cooling",
        "location": "Mumbai, Maharashtra, India",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "radius_km": 30,
        "max_candidates": 6,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["recommendations"] == []


def test_service_aliases_match_real_providers_without_cross_location_leakage():
    from app.core.config import settings

    configured_api_key = settings.LLM_API_KEY
    settings.LLM_API_KEY = ""
    try:
        analysis = client.post("/api/ai/analyze-problem", json={
            "query": "I need plumbing",
            "location": "Koramangala, Bengaluru",
        })
        assert analysis.status_code == 200
        analysis_data = analysis.json()
        assert analysis_data["service"] == "Plumbing"
        assert analysis_data["service_id"] == 1

        nearby = client.post("/api/ai/recommend", json={
            "query": "My kitchen tap is leaking",
            "service_id": analysis_data["service_id"],
            "location": "Koramangala, Bengaluru",
            "latitude": 12.9352,
            "longitude": 77.6245,
            "max_candidates": 6,
        })
        assert nearby.status_code == 200
        nearby_data = nearby.json()
        assert nearby_data["recommendations"]
        assert all(item["service"] == "Plumbing" for item in nearby_data["recommendations"])

        remote = client.post("/api/ai/recommend", json={
            "query": "I need plumbing",
            "service_id": analysis_data["service_id"],
            "location": "Mumbai, Maharashtra",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "max_candidates": 6,
        })
        assert remote.status_code == 200
        assert remote.json()["recommendations"] == []
    finally:
        settings.LLM_API_KEY = configured_api_key


def test_assistant_chat_uses_grounded_fallback_without_external_llm():
    from app.core.config import settings

    configured_api_key = settings.LLM_API_KEY
    settings.LLM_API_KEY = ""
    try:
        response = client.post("/api/assistant/chat", json={
            "message": "My AC is running but not cooling",
            "location": "Koramangala, Bengaluru",
            "latitude": 12.9352,
            "longitude": 77.6245,
        })
    finally:
        settings.LLM_API_KEY = configured_api_key

    assert response.status_code == 200
    data = response.json()
    assert data["suggested_service"]["name"] == "AC Repair"
    assert data["response"]


def test_assistant_chat_uses_grounded_fallback_on_llm_timeout(monkeypatch):
    import httpx
    from app.core.config import settings
    from app.services import assistant_service

    class TimeoutClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            raise httpx.ReadTimeout("simulated provider timeout")

        async def __aexit__(self, exc_type, exc, traceback):
            return False

    configured_api_key = settings.LLM_API_KEY
    configured_provider = settings.LLM_PROVIDER
    settings.LLM_API_KEY = "test-key"
    settings.LLM_PROVIDER = "gemini"
    monkeypatch.setattr(assistant_service.httpx, "AsyncClient", TimeoutClient)
    try:
        response = client.post("/api/assistant/chat", json={"message": "My kitchen sink is leaking"})
    finally:
        settings.LLM_API_KEY = configured_api_key
        settings.LLM_PROVIDER = configured_provider

    assert response.status_code == 200
    assert response.json()["suggested_service"]["name"] == "Plumbing"
    assert response.json()["response"]


def test_chat_provider_failure_persists_user_message_for_retry(monkeypatch):
    from app.services.assistant_service import AssistantService
    import uuid

    login = client.post("/api/auth/login", json={
        "email": "user@marketplace.com",
        "password": "UserPassword123!",
    })
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    conversation = client.post("/api/chat/conversations", json={}, headers=headers).json()
    request_id = str(uuid.uuid4())

    async def fail_chat(*args, **kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(AssistantService, "process_chat", fail_chat)
    response = client.post(
        f"/api/chat/conversations/{conversation['id']}/messages",
        json={"message": "test retry persistence", "client_message_id": request_id},
        headers=headers,
    )

    assert response.status_code == 502
    messages = client.get(
        f"/api/chat/conversations/{conversation['id']}/messages",
        headers=headers,
    ).json()
    assert len(messages) == 1
    assert messages[0]["client_message_id"] == request_id


def test_provider_can_view_and_accept_customer_booking():
    from datetime import date, timedelta
    import uuid

    customer_login = client.post("/api/auth/login", json={
        "email": "user@marketplace.com",
        "password": "UserPassword123!",
    })
    provider_login = client.post("/api/auth/login", json={
        "email": "provider@marketplace.com",
        "password": "ProviderPassword123!",
    })
    assert customer_login.status_code == 200
    assert provider_login.status_code == 200

    customer_headers = {"Authorization": f"Bearer {customer_login.json()['access_token']}"}
    provider_headers = {"Authorization": f"Bearer {provider_login.json()['access_token']}"}
    provider_services = client.get("/api/providers/me/services", headers=provider_headers)
    approved_offer = next(item for item in provider_services.json() if item["status"] == "APPROVED" and item["is_active"])
    unique_suffix = uuid.uuid4().int % 100000

    booking_response = client.post("/api/bookings", json={
        "provider_id": provider_login.json()["user"]["provider_id"],
        "service_id": approved_offer["service_id"],
        "customer_full_name": "Alex Johnson",
        "customer_mobile": "+91-9876543210",
        "customer_email": "user@marketplace.com",
        "booking_date": (date.today() + timedelta(days=unique_suffix + 30)).isoformat(),
        "booking_time": f"10:{unique_suffix % 60:02d}",
        "service_address": "5th Block, Koramangala, Bengaluru",
        "special_instructions": "Please confirm the appointment.",
    }, headers=customer_headers)
    assert booking_response.status_code == 201
    booking = booking_response.json()
    assert booking["status"] == "PENDING"

    provider_bookings = client.get("/api/bookings/provider", headers=provider_headers)
    assigned = next(item for item in provider_bookings.json() if item["id"] == booking["id"])
    assert assigned["status"] == "PENDING"

    accept_response = client.patch(
        f"/api/bookings/{booking['id']}/status",
        json={"status": "ACCEPTED"},
        headers=provider_headers,
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["status"] == "ACCEPTED"


def test_login_invalid_password():
    payload = {
        "email": "user@marketplace.com",
        "password": "WrongPassword!"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_admin_protection():
    from app.core.config import settings

    # Regular user cannot access /api/users/
    login_payload = {
        "email": "user@marketplace.com",
        "password": "UserPassword123!"
    }
    user_token = client.post("/api/auth/login", json=login_payload).json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    forbidden_resp = client.get("/api/users/", headers=user_headers)
    assert forbidden_resp.status_code == 403

    # Admin CAN access /api/users/
    admin_login = {
        "email": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    admin_token = client.post("/api/auth/login", json=admin_login).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_resp = client.get("/api/users/", headers=admin_headers)
    assert admin_resp.status_code == 200
    assert isinstance(admin_resp.json(), list)
    assert len(admin_resp.json()) >= 1


def test_prevent_direct_admin_registration():
    payload = {
        "email": "fakeadmin@example.com",
        "password": "AdminPass123!",
        "full_name": "Fake Admin",
        "role": "ADMIN"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 403
