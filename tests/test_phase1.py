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


def test_login_invalid_password():
    payload = {
        "email": "user@marketplace.com",
        "password": "WrongPassword!"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_admin_protection():
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
        "email": "admin@marketplace.com",
        "password": "AdminPassword123!"
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
