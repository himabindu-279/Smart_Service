import logging
from sqlalchemy.orm import Session
from app.db.base_class import Base
from app.db.session import engine
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.enums import UserRole, BookingStatus, ServiceApprovalStatus
from app.models.user import User
from app.models.provider import Provider
from app.models.category import Category
from app.models.service import Service
from app.models.provider_service import ProviderService
from app.models.booking import Booking
from app.models.review import Review
from app.models.rating import Rating

logger = logging.getLogger("uvicorn.error")

INITIAL_DATA = [
    {
        "category": "Home Services",
        "slug": "home-services",
        "description": "Essential home maintenance, repair, and cleaning services.",
        "icon": "home",
        "services": [
            {"name": "Plumbing", "slug": "plumbing", "base_price": 450.0, "duration": 60, "description": "Pipe leakage, tap replacement, bathroom fittings, and drain cleaning."},
            {"name": "AC Repair", "slug": "ac-repair", "base_price": 600.0, "duration": 90, "description": "AC cooling repair, gas charging, filter servicing, and compressor overhaul."},
            {"name": "AC Maintenance", "slug": "ac-maintenance", "base_price": 499.0, "duration": 60, "description": "Preventive inspection, deep coil cleaning, filter wash, and refrigerant pressure check."},
            {"name": "AC Installation", "slug": "ac-installation", "base_price": 1200.0, "duration": 120, "description": "Split and window AC copper piping, indoor/outdoor mounting, and vacuum testing."},
            {"name": "Electrical", "slug": "electrical", "base_price": 350.0, "duration": 45, "description": "Switchboard repair, wiring, MCB tripping fix, and fan installation."},
            {"name": "Cleaning", "slug": "cleaning", "base_price": 1200.0, "duration": 180, "description": "Full home deep cleaning, kitchen cleaning, and sofa shampooing."},
            {"name": "Pest Control", "slug": "pest-control", "base_price": 999.0, "duration": 120, "description": "Cockroach, termite, bed bug, and rodent eradication treatment."}
        ]
    },
    {
        "category": "Healthcare",
        "slug": "healthcare",
        "description": "Professional healthcare, medical consultations, and in-home care.",
        "icon": "heart-pulse",
        "services": [
            {"name": "Doctor Consultation", "slug": "doctor-consultation", "base_price": 800.0, "duration": 30, "description": "In-person general physician consultation and health diagnosis."},
            {"name": "Nurse at Home", "slug": "nurse-at-home", "base_price": 1000.0, "duration": 240, "description": "Post-surgical care, wound dressing, injection administration, and patient care."},
            {"name": "Physiotherapy", "slug": "physiotherapy", "base_price": 750.0, "duration": 60, "description": "Musculoskeletal therapy, post-stroke rehabilitation, and pain relief exercises."},
            {"name": "Lab Services", "slug": "lab-services", "base_price": 500.0, "duration": 30, "description": "Doorstep blood sample collection and diagnostic health checkups."}
        ]
    },
    {
        "category": "Food Services",
        "slug": "food-services",
        "description": "Catering, home chef meals, bakery, and party food services.",
        "icon": "utensils",
        "services": [
            {"name": "Catering", "slug": "catering", "base_price": 5000.0, "duration": 300, "description": "Event catering for parties, weddings, corporate events with custom menus."},
            {"name": "Home Food", "slug": "home-food", "base_price": 300.0, "duration": 60, "description": "Hygienic, authentic home-cooked meals delivered warm daily."},
            {"name": "Baker", "slug": "baker", "base_price": 600.0, "duration": 120, "description": "Custom celebratory cakes, pastries, sourdough bread, and desserts."},
            {"name": "Meal Services", "slug": "meal-services", "base_price": 2500.0, "duration": 120, "description": "Weekly and monthly subscription-based nutritious meal boxes."}
        ]
    },
    {
        "category": "Education",
        "slug": "education",
        "description": "Personalized tutoring, test preparation, and skill coaching.",
        "icon": "graduation-cap",
        "services": [
            {"name": "Tutors", "slug": "tutors", "base_price": 500.0, "duration": 60, "description": "School level subject tutoring for CBSE, ICSE, and State Boards."},
            {"name": "Programming", "slug": "programming", "base_price": 800.0, "duration": 60, "description": "1-on-1 coding mentorship in Python, JavaScript, Data Structures, and Web Dev."},
            {"name": "Mathematics", "slug": "mathematics", "base_price": 600.0, "duration": 60, "description": "Calculus, Algebra, Geometry, and competitive exam math problem-solving."},
            {"name": "English", "slug": "english", "base_price": 450.0, "duration": 60, "description": "Spoken English fluency, business communication, and IELTS/TOEFL prep."}
        ]
    },
    {
        "category": "Automotive",
        "slug": "automotive",
        "description": "Doorstep vehicle repairs, regular maintenance, and breakdown support.",
        "icon": "car",
        "services": [
            {"name": "Car Repair", "slug": "car-repair", "base_price": 1200.0, "duration": 120, "description": "Engine diagnostics, brake pad replacement, and mechanical repair."},
            {"name": "Bike Repair", "slug": "bike-repair", "base_price": 400.0, "duration": 60, "description": "General two-wheeler servicing, chain tightening, oil change, and clutch adjustment."},
            {"name": "Servicing", "slug": "servicing", "base_price": 1500.0, "duration": 180, "description": "Periodic vehicle service package including oil, filter, wash, and multi-point inspection."}
        ]
    }
]

PROVIDERS_SEED = [
    {
        "email": "provider@marketplace.com",
        "name": "Ravi Kumar",
        "business": "Ravi AC & Cooling Solutions",
        "service_slug": "ac-repair",
        "custom_price": 550.0,
        "bio": "Certified HVAC technician with over 8 years of hands-on experience in residential and commercial cooling systems.",
        "experience": 8,
        "qualifications": "Certified HVAC Specialist, B.Tech Mech",
        "address": "12th Main, Sector 4, HSR Layout, Bengaluru",
        "lat": 12.9116,
        "lon": 77.6389,
        "rating": 4.8,
        "reviews_count": 42
    },
    {
        "email": "plumber@marketplace.com",
        "name": "Manoj Sharma",
        "business": "Apex Plumbing & Sanitations",
        "service_slug": "plumbing",
        "custom_price": 400.0,
        "bio": "Expert plumber specialized in precision leak detection, pipe fixing, and sanitary fittings.",
        "experience": 6,
        "qualifications": "Licensed Master Plumber",
        "address": "5th Block, Koramangala, Bengaluru",
        "lat": 12.9352,
        "lon": 77.6245,
        "rating": 4.7,
        "reviews_count": 31
    },
    {
        "email": "doctor@marketplace.com",
        "name": "Dr. Priya Nair",
        "business": "Dr. Priya In-Home Care",
        "service_slug": "doctor-consultation",
        "custom_price": 750.0,
        "bio": "Senior general physician offering doorstep medical examinations, preventive health checks, and elderly patient care.",
        "experience": 10,
        "qualifications": "MBBS, MD (General Medicine)",
        "address": "100 Feet Road, Indiranagar, Bengaluru",
        "lat": 12.9784,
        "lon": 77.6408,
        "rating": 4.9,
        "reviews_count": 58
    },
    {
        "email": "electrician@marketplace.com",
        "name": "Kiran Reddy",
        "business": "Kiran Power & Electricals",
        "service_slug": "electrical",
        "custom_price": 320.0,
        "bio": "Certified commercial and domestic electrician with expertise in safety wiring, inverter setups, and lighting.",
        "experience": 5,
        "qualifications": "ITI Electrical Certified",
        "address": "4th Block, Jayanagar, Bengaluru",
        "lat": 12.9250,
        "lon": 77.5938,
        "rating": 4.6,
        "reviews_count": 27
    },
    {
        "email": "auto@marketplace.com",
        "name": "Farhan Ahmed",
        "business": "Speedy Auto Car & Bike Works",
        "service_slug": "car-repair",
        "custom_price": 1100.0,
        "bio": "Doorstep automobile diagnostics, emergency breakdown assistance, and preventive maintenance technician.",
        "experience": 9,
        "qualifications": "Automotive Engineering Diploma",
        "address": "BTM 2nd Stage, Bengaluru",
        "lat": 12.9165,
        "lon": 77.6101,
        "rating": 4.8,
        "reviews_count": 39
    }
]


def init_db(db: Session) -> None:
    """Create all database tables and seed initial administrator, categories, and providers."""
    logger.info("Creating database tables if not exist...")
    Base.metadata.create_all(bind=engine)

    # 1. Seed Super Admin
    admin_user = db.query(User).filter(User.email == settings.FIRST_SUPERUSER_EMAIL).first()
    if not admin_user:
        logger.info(f"Creating super admin: {settings.FIRST_SUPERUSER_EMAIL}")
        admin_user = User(
            email=settings.FIRST_SUPERUSER_EMAIL,
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            full_name=settings.FIRST_SUPERUSER_NAME,
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin_user)
        db.commit()

    # 2. Seed Standard User
    demo_user = db.query(User).filter(User.email == "user@marketplace.com").first()
    if not demo_user:
        logger.info("Creating demo user: user@marketplace.com")
        demo_user = User(
            email="user@marketplace.com",
            hashed_password=get_password_hash("UserPassword123!"),
            full_name="Alex Johnson",
            phone="+91-9876543210",
            role=UserRole.USER,
            is_active=True
        )
        db.add(demo_user)
        db.commit()

    # 3. Seed Categories and Services
    for cat_data in INITIAL_DATA:
        category = db.query(Category).filter(Category.slug == cat_data["slug"]).first()
        if not category:
            category = Category(
                name=cat_data["category"],
                slug=cat_data["slug"],
                description=cat_data["description"],
                icon=cat_data["icon"],
                is_active=True
            )
            db.add(category)
            db.flush()

        for svc_data in cat_data["services"]:
            service = db.query(Service).filter(Service.slug == svc_data["slug"]).first()
            if not service:
                service = Service(
                    category_id=category.id,
                    name=svc_data["name"],
                    slug=svc_data["slug"],
                    description=svc_data["description"],
                    base_price=svc_data["base_price"],
                    estimated_duration_minutes=svc_data["duration"],
                    is_active=True
                )
                db.add(service)

    db.commit()

    # 4. Seed Providers and Link Services
    for prov in PROVIDERS_SEED:
        p_user = db.query(User).filter(User.email == prov["email"]).first()
        if not p_user:
            p_user = User(
                email=prov["email"],
                hashed_password=get_password_hash("ProviderPassword123!"),
                full_name=prov["name"],
                phone="+91-9876500000",
                role=UserRole.PROVIDER,
                is_active=True
            )
            db.add(p_user)
            db.flush()

            profile = Provider(
                user_id=p_user.id,
                business_name=prov["business"],
                bio=prov["bio"],
                experience_years=prov["experience"],
                qualifications=prov["qualifications"],
                address=prov["address"],
                latitude=prov["lat"],
                longitude=prov["lon"],
                is_verified=True,
                is_available=True,
                rating_avg=prov["rating"],
                total_ratings=prov["reviews_count"]
            )
            db.add(profile)
            db.flush()

            # Link primary service
            svc = db.query(Service).filter(Service.slug == prov["service_slug"]).first()
            if svc:
                ps = ProviderService(
                    provider_id=profile.id,
                    service_id=svc.id,
                    category_id=svc.category_id,
                    custom_service_name=svc.name,
                    custom_price=prov["custom_price"],
                    description=f"Specialist in {svc.name} diagnosis and precision service.",
                    experience=f"{prov['experience']} years",
                    service_location=prov["address"],
                    status=ServiceApprovalStatus.APPROVED,
                    is_active=True
                )
                db.add(ps)

            # Link multiple services for Ravi Services (AC Repair, AC Maintenance, AC Installation)
            if prov["email"] == "provider@marketplace.com":
                for extra_slug, extra_price in [("ac-maintenance", 450.0), ("ac-installation", 1100.0)]:
                    extra_svc = db.query(Service).filter(Service.slug == extra_slug).first()
                    if extra_svc:
                        extra_ps = ProviderService(
                            provider_id=profile.id,
                            service_id=extra_svc.id,
                            category_id=extra_svc.category_id,
                            custom_service_name=extra_svc.name,
                            custom_price=extra_price,
                            description=f"Expert in {extra_svc.name}.",
                            experience="8 years",
                            service_location=prov["address"],
                            status=ServiceApprovalStatus.APPROVED,
                            is_active=True
                        )
                        db.add(extra_ps)

    # 5. Seed initial completed booking & review for demo customer & provider
    demo_cust = db.query(User).filter(User.email == "user@marketplace.com").first()
    demo_prov = db.query(Provider).first()
    ac_svc = db.query(Service).filter(Service.slug == "ac-repair").first()

    if demo_cust and demo_prov and ac_svc:
        existing_b = db.query(Booking).filter(Booking.booking_reference == "BK-DEMO-001").first()
        if not existing_b:
            booking = Booking(
                booking_reference="BK-DEMO-001",
                user_id=demo_cust.id,
                provider_id=demo_prov.id,
                service_id=ac_svc.id,
                booking_date="2026-09-24",
                booking_time="10:00",
                status=BookingStatus.COMPLETED,
                total_amount=550.0,
                service_address="14/B, 5th Cross, HSR Layout, Bengaluru",
                special_instructions="AC cooling was low."
            )
            db.add(booking)
            db.flush()

            rev = Review(
                booking_id=booking.id,
                user_id=demo_cust.id,
                provider_id=demo_prov.id,
                service_id=ac_svc.id,
                review_text="Excellent technician. Diagnosed the compressor gas leak within 15 minutes and fixed it promptly. Highly recommended!",
                sentiment="POSITIVE",
                sentiment_score=0.96
            )
            db.add(rev)

            rat = Rating(
                booking_id=booking.id,
                user_id=demo_cust.id,
                provider_id=demo_prov.id,
                score=5.0,
                aspect_punctuality=5.0,
                aspect_quality=5.0,
                aspect_cost=4.8
            )
            db.add(rat)

    db.commit()
    logger.info("Database initialized with full demo dataset successfully.")
