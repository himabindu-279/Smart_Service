import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.enums import UserRole
from app.models.provider import Provider
from app.models.provider_service import ProviderService
from app.models.service import Service
from app.models.review import Review

PROVIDERS_DATA = [
    # Home Services
    {
        "email": "cleaning@marketplace.com",
        "name": "Sunita Rao",
        "business": "SparkleClean Deep Cleaning & Sanitization",
        "service_slug": "cleaning",
        "custom_price": 999.0,
        "bio": "Certified deep cleaning expert for apartments, villas, sofas, kitchens, and commercial workspaces using eco-friendly solutions.",
        "experience": 7,
        "qualifications": "Certified Cleaning Specialist & Team Lead",
        "address": "Indiranagar, Central District",
        "lat": 19.0760, "lon": 72.8777,
        "rating": 4.8, "reviews_count": 42
    },
    {
        "email": "pestcontrol@marketplace.com",
        "name": "Vikram Malhotra",
        "business": "SafePest Herbal Pest & Termite Control",
        "service_slug": "pest-control",
        "custom_price": 850.0,
        "bio": "Specialized in non-toxic odorless pest management, anti-termite piping treatment, and cockroach control with warranty.",
        "experience": 8,
        "qualifications": "Govt Licensed Pest Management Officer",
        "address": "Sector 4, Green Park",
        "lat": 19.0820, "lon": 72.8850,
        "rating": 4.9, "reviews_count": 56
    },
    {
        "email": "acmaint@marketplace.com",
        "name": "Ramesh Kumar",
        "business": "CoolBreeze HVAC Maintenance & Jet Clean",
        "service_slug": "ac-maintenance",
        "custom_price": 450.0,
        "bio": "Complete seasonal AC servicing, indoor foam jet cleaning, outdoor unit descaling, and power efficiency tuning.",
        "experience": 6,
        "qualifications": "HVAC Certified Technician",
        "address": "Central Avenue, Block A",
        "lat": 19.0680, "lon": 72.8710,
        "rating": 4.7, "reviews_count": 34
    },
    {
        "email": "acinstall@marketplace.com",
        "name": "Anil Soni",
        "business": "Precision AC Mounting & Piping Installation",
        "service_slug": "ac-installation",
        "custom_price": 1150.0,
        "bio": "Expert split and inverter AC installation, copper line vacuum testing, core cutting, and vibration damping brackets.",
        "experience": 9,
        "qualifications": "Senior Refrigeration & HVAC Engineer",
        "address": "Tech Park Road, Phase 2",
        "lat": 19.0910, "lon": 72.8690,
        "rating": 4.8, "reviews_count": 29
    },
    {
        "email": "computer@marketplace.com",
        "name": "Deepak Joshi",
        "business": "ByteFix Computer & Laptop Express Care",
        "service_slug": "computer-laptop-repair",
        "custom_price": 499.0,
        "bio": "Hardware level chip repair, SSD & RAM upgrades, screen replacement, liquid spill cleanup, and Windows/Mac troubleshooting.",
        "experience": 8,
        "qualifications": "B.Tech Computer Engg / CompTIA A+ Certified",
        "address": "Cyber Towers, IT Corridor",
        "lat": 19.0720, "lon": 72.8810,
        "rating": 4.9, "reviews_count": 67
    },

    # Healthcare Services
    {
        "email": "nurse@marketplace.com",
        "name": "Sister Mary D'Souza",
        "business": "CareHealth Home Nursing & Elder Care",
        "service_slug": "nurse-at-home",
        "custom_price": 900.0,
        "bio": "Experienced registered clinical nurse providing IV drip administration, wound care, post-surgical rehabilitation, and elderly vitals tracking.",
        "experience": 11,
        "qualifications": "B.Sc Nursing, Registered Clinical Nurse",
        "address": "Health Enclave, Ward 7",
        "lat": 19.0740, "lon": 72.8730,
        "rating": 4.9, "reviews_count": 48
    },
    {
        "email": "physio@marketplace.com",
        "name": "Dr. Rohit Saxena",
        "business": "ActiveSpine Physiotherapy & Mobility Clinic",
        "service_slug": "physiotherapy",
        "custom_price": 700.0,
        "bio": "Specialized in disc herniation, sciatica relief, stroke rehabilitation, postural correction, and sports injury recovery.",
        "experience": 9,
        "qualifications": "BPT, MPT (Musculoskeletal)",
        "address": "Wellness Road, Block 3",
        "lat": 19.0800, "lon": 72.8790,
        "rating": 4.8, "reviews_count": 52
    },
    {
        "email": "lab@marketplace.com",
        "name": "Suresh Patel",
        "business": "PathoFast Doorstep Blood & Diagnostic Collection",
        "service_slug": "lab-services",
        "custom_price": 450.0,
        "bio": "NABL accredited sample collection at your doorstep. Fast turnaround digital reporting for CBC, Lipid, Thyroid, HbA1c, and Vitamin tests.",
        "experience": 7,
        "qualifications": "DMLT, Medical Laboratory Technologist",
        "address": "MediCross Plaza, Central",
        "lat": 19.0770, "lon": 72.8830,
        "rating": 4.8, "reviews_count": 71
    },

    # Food Services
    {
        "email": "catering@marketplace.com",
        "name": "Chef Rajesh Kapoor",
        "business": "RoyalFeast Gourmet Event Catering",
        "service_slug": "catering",
        "custom_price": 4500.0,
        "bio": "Exquisite multi-cuisine banquet catering for weddings, corporate celebrations, birthday parties, and intimate family gatherings.",
        "experience": 14,
        "qualifications": "Diploma in Hotel Management & Culinary Arts",
        "address": "Banquet Lane, Grand Central",
        "lat": 19.0850, "lon": 72.8750,
        "rating": 4.9, "reviews_count": 83
    },
    {
        "email": "homefood@marketplace.com",
        "name": "Kavita Deshmukh",
        "business": "Maa Ki Rasoi Daily Fresh Tiffin",
        "service_slug": "home-food",
        "custom_price": 250.0,
        "bio": "Hygienic, wholesome, homely meals cooked with cold-pressed oils and pure ingredients. Daily lunch & dinner subscription meal boxes.",
        "experience": 6,
        "qualifications": "Certified Food Safety & FSSAI Registered",
        "address": "Shanti Niketan, Sector 2",
        "lat": 19.0710, "lon": 72.8740,
        "rating": 4.9, "reviews_count": 95
    },
    {
        "email": "baker@marketplace.com",
        "name": "Neha Agarwal",
        "business": "SweetCrust Designer Cakes & Artisan Bakes",
        "service_slug": "baker",
        "custom_price": 550.0,
        "bio": "Custom tiered birthday cakes, artisanal sourdough loaves, gluten-free brownies, and bespoke desserts baked fresh to order.",
        "experience": 5,
        "qualifications": "Pastry Arts Diploma, Le Cordon Bleu Certified",
        "address": "Bakers Street, East Colony",
        "lat": 19.0790, "lon": 72.8820,
        "rating": 4.9, "reviews_count": 64
    },
    {
        "email": "meals@marketplace.com",
        "name": "Tanmay Sen",
        "business": "FitDiet Macro-Balanced Meal Plans",
        "service_slug": "meal-services",
        "custom_price": 2200.0,
        "bio": "Calorie-counted, high-protein keto and athlete nutrition plans delivered daily to your doorstep with customized macro consultations.",
        "experience": 6,
        "qualifications": "Sports Nutritionist & Certified Chef",
        "address": "FitZone Avenue, North Gate",
        "lat": 19.0830, "lon": 72.8760,
        "rating": 4.8, "reviews_count": 41
    },

    # Education Services
    {
        "email": "tutors@marketplace.com",
        "name": "Arun Swaminathan",
        "business": "BrightMinds Academic Home Tuition",
        "service_slug": "tutors",
        "custom_price": 450.0,
        "bio": "Personalized 1-on-1 tutoring for CBSE, ICSE, and State board students (Grades 6–12) focusing on concept clarity and test scores.",
        "experience": 10,
        "qualifications": "M.Sc Physics, B.Ed",
        "address": "Scholars Lane, Sector 5",
        "lat": 19.0750, "lon": 72.8800,
        "rating": 4.9, "reviews_count": 58
    },
    {
        "email": "programming@marketplace.com",
        "name": "Aditya Varma",
        "business": "DevMaster Python, AI & FullStack Mentorship",
        "service_slug": "programming",
        "custom_price": 750.0,
        "bio": "Hands-on software development coaching in Python, JavaScript, React, FastAPI, Algorithms, and System Design for college and job prep.",
        "experience": 7,
        "qualifications": "Senior Software Architect, Ex-FAANG Mentor",
        "address": "Silicon Grove, Block 9",
        "lat": 19.0780, "lon": 72.8720,
        "rating": 5.0, "reviews_count": 88
    },
    {
        "email": "math@marketplace.com",
        "name": "Sanjay Narang",
        "business": "QuantEdge Advanced Mathematics & JEE Coaching",
        "service_slug": "mathematics",
        "custom_price": 550.0,
        "bio": "Specialized coaching in Calculus, Algebra, Trigonometry, and Competitive exam math for JEE Mains, Advanced, and SAT.",
        "experience": 12,
        "qualifications": "M.Sc Mathematics, IIT Bombay Alum",
        "address": "Academic Circle, Ward 4",
        "lat": 19.0810, "lon": 72.8840,
        "rating": 4.9, "reviews_count": 62
    },
    {
        "email": "english@marketplace.com",
        "name": "Rachel Fernandez",
        "business": "FluentEdge Spoken English & IELTS Masterclass",
        "service_slug": "english",
        "custom_price": 400.0,
        "bio": "Spoken English fluency, accent neutralization, corporate communication, and IELTS/TOEFL Band 8+ prep training.",
        "experience": 8,
        "qualifications": "MA English Literature, CELTA Certified",
        "address": "Linguistic Park, West Enclave",
        "lat": 19.0730, "lon": 72.8780,
        "rating": 4.8, "reviews_count": 47
    },

    # Automotive Services
    {
        "email": "bikerepair@marketplace.com",
        "name": "Mohammad Irfan",
        "business": "SpeedyMoto Two-Wheeler Doorstep Garage",
        "service_slug": "bike-repair",
        "custom_price": 380.0,
        "bio": "Doorstep breakdown assist, engine oil flush, disc brake service, chain adjustment, and electrical repairs for all motorcycles and scooters.",
        "experience": 11,
        "qualifications": "Certified Multi-brand Motorcycle Specialist",
        "address": "Motor Works Road, Central",
        "lat": 19.0740, "lon": 72.8860,
        "rating": 4.8, "reviews_count": 79
    },
    {
        "email": "servicing@marketplace.com",
        "name": "Karthik Pillai",
        "business": "AutoCare Express Periodic Vehicle Servicing",
        "service_slug": "servicing",
        "custom_price": 1350.0,
        "bio": "Full 40-point vehicle inspection, computerized OBD-II scanning, synthetic engine oil change, radiator flush, and underbody inspection.",
        "experience": 10,
        "qualifications": "Certified Automotive Diagnostic Technician",
        "address": "Auto Hub Expressway, Sector 8",
        "lat": 19.0860, "lon": 72.8730,
        "rating": 4.9, "reviews_count": 65
    }
]

def seed_missing_providers():
    db = SessionLocal()
    try:
        created_count = 0
        for pdata in PROVIDERS_DATA:
            # 1. Check or create User
            user = db.query(User).filter(User.email == pdata["email"]).first()
            if not user:
                user = User(
                    email=pdata["email"],
                    hashed_password=get_password_hash("Provider123!"),
                    full_name=pdata["name"],
                    role=UserRole.PROVIDER,
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)

            # 2. Check or create Provider
            provider = db.query(Provider).filter(Provider.user_id == user.id).first()
            if not provider:
                provider = Provider(
                    user_id=user.id,
                    business_name=pdata["business"],
                    bio=pdata["bio"],
                    experience_years=pdata["experience"],
                    qualifications=pdata["qualifications"],
                    address=pdata["address"],
                    latitude=pdata["lat"],
                    longitude=pdata["lon"],
                    is_verified=True,
                    is_available=True,
                    rating_avg=pdata["rating"],
                    total_ratings=pdata["reviews_count"]
                )
                db.add(provider)
                db.commit()
                db.refresh(provider)
                created_count += 1
            else:
                provider.is_available = True
                provider.is_verified = True
                db.commit()

            # 3. Find service by slug
            service = db.query(Service).filter(Service.slug == pdata["service_slug"]).first()
            if not service:
                # Try finding by name or partial slug
                slug_clean = pdata["service_slug"].replace("-", " ")
                service = db.query(Service).filter(Service.name.ilike(f"%{slug_clean}%")).first()

            if service:
                # Link provider to service
                ps = db.query(ProviderService).filter(
                    ProviderService.provider_id == provider.id,
                    ProviderService.service_id == service.id
                ).first()
                if not ps:
                    ps = ProviderService(
                        provider_id=provider.id,
                        service_id=service.id,
                        custom_price=pdata["custom_price"],
                        experience_description=pdata["bio"],
                        is_active=True
                    )
                    db.add(ps)
                    db.commit()
                else:
                    ps.is_active = True
                    ps.custom_price = pdata["custom_price"]
                    db.commit()



        print(f"Successfully seeded {created_count} verified providers across all services.")

        # Verification
        services = db.query(Service).all()
        for s in services:
            ps_count = db.query(ProviderService).filter(ProviderService.service_id == s.id, ProviderService.is_active == True).count()
            print(f"Service '{s.name}' (id={s.id}): {ps_count} active provider(s)")

    finally:
        db.close()

if __name__ == "__main__":
    seed_missing_providers()
