# AI-Driven Smart Service Marketplace with Personalized Recommendation and Intelligent Provider Matching

A production-grade, full-stack final year B.Tech computer science engineering project. The platform connects consumers with localized service providers across categories such as Home Services, Healthcare, Food Services, Education, and Automotive, leveraging multi-stage deep learning recommendation pipelines and heterogeneous graph transformers.

---

## 🌟 Architecture Overview

```
                                  +------------------------------------+
                                  |         React User Frontend        |
                                  |    (Discover, Services, Maps, ...) |
                                  +-----------------+------------------+
                                                    |
                                                    v
+-------------------------------------------------------------------------------------------------------+
|                                    FastAPI High-Performance Backend                                   |
|                                                                                                       |
|  +--------------------+   +-----------------------+   +-------------------+   +--------------------+  |
|  | JWT Authentication |   | Role-Based Access     |   | Location-Based    |   | Booking & Orders   |  |
|  | & Password Hashing |   | (USER/PROVIDER/ADMIN) |   | Haversine Radius  |   | State Lifecycle    |  |
|  +--------------------+   +-----------------------+   +-------------------+   +--------------------+  |
|                                                                                                       |
|  +-------------------------------------------------------------------------------------------------+  |
|  |                                  Multi-Stage AI/ML Pipeline                                     |  |
|  |                                                                                                 |  |
|  |   User Natural Language Query                                                                   |  |
|  |               │                                                                                 |  |
|  |               ▼                                                                                 |  |
|  |     [ BGE-M3 Embeddings ] ──> Semantic Service Understanding & Intent Extraction                 |  |
|  |               │                                                                                 |  |
|  |               ▼                                                                                 |  |
|  |   [ Spatial & Category Filter ] ──> Nearby Available Provider Candidates                        |  |
|  |               │                                                                                 |  |
|  |               ▼                                                                                 |  |
|  |       [ BERT4Rec Model ] ──> Sequential Personalized Candidate Generation                       |  |
|  |               │                                                                                 |  |
|  |               ▼                                                                                 |  |
|  |          [ HGT GNN ] ──> Heterogeneous Graph Provider Suitability Scoring                       |  |
|  |               │                                                                                 |  |
|  |               ▼                                                                                 |  |
|  |      [ Cross-Encoder ] ──> Deep Semantic Re-Ranking                                             |  |
|  |               │                                                                                 |  |
|  |               ▼                                                                                 |  |
|  |  [ Multi-Objective Ranking ] ──> Final Providers + Explainable Match Reasons                   |  |
|  |                                                                                                 |  |
|  |   Review Text ──> [ DeBERTa-v3 Sentiment Analysis ] ──> Provider Quality Feature                |  |
|  +-------------------------------------------------------------------------------------------------+  |
+---------------------------------------------------+---------------------------------------------------+
                                                    |
                                                    v
                                  +------------------------------------+
                                  |     PostgreSQL Relational DB       |
                                  | (Users, Providers, Services, Maps) |
                                  +------------------------------------+
```

---

## 📁 Repository Structure

```
smart-service-marketplace/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── auth.py         # Registration & JWT login
│   │   │   │   │   ├── users.py        # /me and Admin user management
│   │   │   │   │   └── health.py       # Health check & DB status
│   │   │   │   └── api.py              # Router mounting
│   │   │   └── deps.py                 # Security & RBAC dependencies
│   │   ├── core/
│   │   │   ├── config.py               # Pydantic Settings configuration
│   │   │   └── security.py             # Bcrypt hashing & JWT utilities
│   │   ├── db/
│   │   │   ├── base.py                 # Metadata declaration
│   │   │   ├── base_class.py           # DeclarativeBase class
│   │   │   ├── session.py              # SQLAlchemy engine & session factory
│   │   │   └── init_db.py              # Schema migration & initial seed data
│   │   ├── models/                     # SQLAlchemy relational models
│   │   │   ├── enums.py                # UserRole and BookingStatus enums
│   │   │   ├── user.py                 # User model (USER, PROVIDER, ADMIN)
│   │   │   ├── provider.py             # Provider profile & credentials
│   │   │   ├── category.py             # Service categories
│   │   │   ├── service.py              # Specific services & base prices
│   │   │   ├── provider_service.py     # Junction with provider pricing
│   │   │   ├── provider_availability.py# Operating hours and day slots
│   │   │   ├── location.py             # User saved addresses & coordinates
│   │   │   ├── booking.py              # Booking lifecycle management
│   │   │   ├── review.py               # Reviews & DeBERTa sentiment
│   │   │   ├── rating.py               # Multi-aspect ratings
│   │   │   └── recommendation.py       # Recommendation audit history
│   │   ├── schemas/                    # Pydantic validation schemas
│   │   │   ├── token.py
│   │   │   ├── user.py
│   │   │   ├── provider.py
│   │   │   ├── category.py
│   │   │   ├── service.py
│   │   │   ├── location.py
│   │   │   ├── booking.py
│   │   │   ├── review.py
│   │   │   └── rating.py
│   │   └── services/
│   │       └── auth_service.py         # User and provider registration logic
│   └── main.py                         # FastAPI application entrypoint
├── database/
│   └── init_db.sql                     # Raw PostgreSQL DDL schema & constraints
├── frontend/                           # React frontend (Phase 2+)
├── ml/                                 # AI pipeline modules (Phase 5+)
│   ├── data/
│   ├── preprocessing/
│   ├── embeddings/                     # BGE-M3 module
│   ├── recommendation/                 # BERT4Rec sequential model
│   ├── gnn/                            # Heterogeneous Graph Transformer (HGT)
│   ├── ranking/                        # Cross-Encoder re-ranker
│   ├── sentiment/                      # DeBERTa-v3 review analyzer
│   ├── training/
│   └── inference/
├── models/                             # Saved model weights
│   ├── bert4rec/
│   ├── hgt/
│   ├── cross_encoder/
│   └── deberta/
├── scripts/                            # Operational helper scripts
├── tests/
│   └── test_phase1.py                  # Integration and unit tests
├── docs/                               # Architecture and API documentation
├── .env                                # Local environment configuration
├── .env.example                        # Template environment configuration
├── requirements.txt                    # Python dependencies
└── README.md                           # Project documentation
```

---

## 🚀 Phase 1 Implementation Summary

Phase 1 establishes the rock-solid foundation for the entire platform:

1. **Database Schema & Relational Models**:
   - `users`: Core identity with role-based access (`USER`, `PROVIDER`, `ADMIN`).
   - `providers`: Professional profile, qualifications, coordinates (`latitude`, `longitude`), verified status, ratings.
   - `categories`: Main domains (Home Services, Healthcare, Food Services, Education, Automotive).
   - `services`: Sub-services with baseline durations and pricing.
   - `provider_services`: Many-to-many junction with custom provider pricing and experience details.
   - `locations`: Geocoded user addresses and primary delivery locations.
   - `provider_availability`: Weekly working day and time slot rules.
   - `bookings`: Transactional records tracking status from `PENDING` to `COMPLETED`.
   - `reviews`: Text feedback with reserved fields for DeBERTa-v3 sentiment classification.
   - `ratings`: Overall (1.0 - 5.0) and granular aspect scores (punctuality, quality, cost).
   - `recommendations`: Query logs and candidate provider explanations.

2. **Security & Authentication**:
   - Native `bcrypt` password hashing with salt rounds.
   - JWT tokens signed with HMAC-SHA256 (`HS256`).
   - Role-based authorization dependencies (`require_admin`, `require_provider`, `require_user`).
   - Protection against unauthorized public registration of administrative accounts.

3. **Core APIs Tested & Verified**:
   - `POST /api/auth/register`: Supports `USER` and `PROVIDER` roles (auto-provisions provider profile for providers).
   - `POST /api/auth/login`: Issues JWT tokens for email and password authentication.
   - `GET /api/users/me`: Protected endpoint returning user details and provider profile.
   - `GET /api/users`: Admin-only endpoint listing all registered accounts.
   - `GET /api/health`: System health check verifying database engine status.

---

## 🛠️ Installation & Setup Guide

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.13)
- PostgreSQL (or local SQLite for dev preview)
- Git

### 2. Environment Configuration
Copy the configuration template:
```bash
cp .env.example .env
```
Set `FIRST_SUPERUSER_EMAIL` and a unique `FIRST_SUPERUSER_PASSWORD`; production startup
refuses to run without them and a `SECRET_KEY` of at least 32 characters. `SEED_DEMO_DATA`
defaults to `False`; enable it only for an isolated local demo database.
Update your `.env` file with your PostgreSQL connection string:
```ini
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/smart_marketplace"
```

### 3. PostgreSQL Database Setup
Create the database in PostgreSQL:
```sql
CREATE DATABASE smart_marketplace;
```
Or run the provided DDL script:
```bash
psql -U postgres -d smart_marketplace -f database/init_db.sql
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Start Backend Server
Run the FastAPI development server:
```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 6. Interactive Documentation & Endpoints
Once started, access:
- **Interactive Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## Provider Verification and Booking Email

Provider registration requires an email verification code, a phone number, a saved
service location, at least one catalog service, and private identity and qualification
documents. Configure backend SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
`SMTP_PASSWORD`, and `SMTP_FROM`) to send provider verification codes and booking
status notifications. Booking status changes are committed before email delivery; failed
booking emails remain in the database outbox for retry.

Set `PRIVATE_UPLOAD_DIR` to a private persistent backend volume in production. Do not
place provider documents under `frontend/public` or any static-file directory. Existing
databases are extended with additive startup migrations; the initialization code does
not drop existing tables or data. Back up the database before deploying schema changes.

Discover problem photos are limited to JPG, PNG, or WebP files up to 5 MB and are stored
under the private upload directory. A photo is sent to the configured LLM provider only
when `LLM_API_KEY` is configured; without it, text-based service analysis still works and
the UI explains that image analysis is unavailable. Voice input uses the browser's
SpeechRecognition implementation when supported.

In-app notifications are stored in the `notifications` table and are available through
`GET /api/notifications`, `PATCH /api/notifications/{id}/read`, and
`PATCH /api/notifications/read-all`. SMS delivery is asynchronous and retries failed
Twilio requests. Set `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` to enable it; without these values, SMS
events remain queued and are not reported as delivered.

---

## 🚦 Running Automated Tests
Run the test suite using `pytest`:
```bash
python -m pytest tests/test_phase1.py backend/tests -v
```
The workflow tests use an isolated in-memory SQLite database and cover provider onboarding,
admin review permissions, Rajam service-radius matching, and booking-email outbox behavior.

## ☁️ Deployment

The Vercel configuration in the repository deploys the React frontend from
`frontend/`. The FastAPI backend should be deployed separately to a Python
host such as Render, Railway, or Fly.io because it uses a persistent database
and heavyweight ML dependencies.

### Deploy the frontend to Vercel

1. Push the repository to GitHub and import it into Vercel.
2. Keep the repository root as the Vercel project root. The root
   `vercel.json` installs and builds `frontend/` and enables SPA routing.
3. Add this Vercel environment variable for the **Production** environment:
   ```ini
   VITE_API_BASE_URL=https://<your-backend-domain>/api
   ```
4. Deploy. The frontend will be available at the Vercel URL.

### Deploy the backend

Deploy the `backend/` directory using the provider's FastAPI/Python service
workflow. Configure `DATABASE_URL`, a random `SECRET_KEY` (at least 32 characters),
`FIRST_SUPERUSER_EMAIL`, `FIRST_SUPERUSER_PASSWORD`, SMTP credentials, and
`PRIVATE_UPLOAD_DIR` on a persistent private volume. Keep demo seeding disabled.
Set CORS to the exact Vercel domain (no trailing slash):
```ini
CORS_ORIGINS=https://<your-vercel-domain>
```

After deployment, verify:
```text
https://<your-backend-domain>/api/health
```
Then set `VITE_API_BASE_URL` in Vercel to that backend URL and redeploy the
frontend.
