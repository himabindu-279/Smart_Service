import urllib.request
import urllib.error
import json
import uuid
import sys
from datetime import date, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api"

def make_req(endpoint, method="GET", body=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(body).encode("utf-8") if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        print(f"Error {e.code} on {method} {endpoint}: {err_content}")
        raise

def test_full_marketplace():
    print("==================================================")
    print("STARTING FULL END-TO-END VERIFICATION TEST SUITE")
    print("==================================================")

    # 1. Signup Customer
    unique_cust_email = f"cust_{uuid.uuid4().hex[:6]}@example.com"
    print(f"\n[1] Registering Customer: {unique_cust_email}")
    cust_reg = make_req("/auth/register", "POST", {
        "email": unique_cust_email,
        "password": "Password123!",
        "full_name": "Test Customer",
        "phone": "+91-9988112233",
        "role": "USER"
    })
    cust_token = cust_reg["access_token"]
    assert cust_reg["user"]["role"] == "USER"
    print(" -> Customer registered successfully!")

    # 2. Login Customer
    print("\n[2] Logging in Customer")
    cust_login = make_req("/auth/login", "POST", {
        "email": unique_cust_email,
        "password": "Password123!"
    })
    assert cust_login["access_token"] is not None
    print(" -> Customer login verified!")

    # 3. User Profile (/users/me)
    print("\n[3] Verifying User Profile")
    me = make_req("/users/me", "GET", token=cust_token)
    assert me["email"] == unique_cust_email
    print(f" -> Profile verified: {me['full_name']} ({me['role']})")

    # 4. Provider Registration & Login
    unique_prov_email = f"prov_{uuid.uuid4().hex[:6]}@example.com"
    print(f"\n[4] Registering Service Provider: {unique_prov_email}")
    prov_reg = make_req("/auth/register", "POST", {
        "email": unique_prov_email,
        "password": "Password123!",
        "full_name": "Deepak Electricals",
        "phone": "+91-9876123456",
        "role": "PROVIDER",
        "business_name": "Deepak Electrical & Appliances",
        "bio": "Certified electrician with 7 years experience.",
        "experience_years": 7,
        "address": "Koramangala, Bengaluru",
        "latitude": 12.9352,
        "longitude": 77.6245
    })
    prov_token = prov_reg["access_token"]
    assert prov_reg["user"]["role"] == "PROVIDER"
    prov_id = prov_reg["user"]["provider_id"]
    print(f" -> Provider registered with profile ID: {prov_id}")

    # 5. Service & Category Loading
    print("\n[5] Loading Categories and Services from PostgreSQL")
    categories = make_req("/categories", "GET")
    assert len(categories) >= 4
    services = make_req("/services", "GET")
    assert len(services) >= 10
    print(f" -> Loaded {len(categories)} categories and {len(services)} services.")

    # 6. Natural Language Search & Service Understanding
    print("\n[6] Testing Natural Language Service Understanding")
    nl_query = "My AC is running but it is not cooling properly"
    ai_detect = make_req("/ai/service-understanding", "POST", {"query": nl_query})
    print(f" -> Query: '{nl_query}'")
    print(f" -> Detected Category: {ai_detect['category']}, Service: {ai_detect['service']} (Confidence: {ai_detect['confidence']})")
    assert "AC" in ai_detect["service"]

    # 7. Multi-Objective AI Recommendations
    print("\n[7] Testing Multi-Objective Recommendation API")
    recs = make_req("/ai/recommend", "POST", {
        "query": nl_query,
        "service_id": ai_detect["service_id"],
        "latitude": 12.9116,
        "longitude": 77.6389,
        "max_candidates": 5
    })
    assert len(recs["recommendations"]) > 0
    top_p = recs["recommendations"][0]
    print(f" -> Top Match: {top_p['business_name']} ({top_p['match_score']}% Match)")
    print(f" -> Reasons: {top_p['reasons']}")

    # 8. Maps & Haversine Distance
    print("\n[8] Testing GIS Spatial Maps API (Haversine)")
    nearby = make_req(f"/maps/nearby?latitude=12.9116&longitude=77.6389&radius_km=20", "GET")
    assert len(nearby) > 0
    print(f" -> Found {len(nearby)} providers within 20km radius:")
    for n in nearby[:3]:
        print(f"    • {n['provider_name']}: {n['distance']} km away, Rating: {n['rating']}★, ₹{n['price']}")

    # 9. Provider Details
    print(f"\n[9] Fetching Provider Details for ID: {top_p['provider_id']}")
    p_detail = make_req(f"/providers/{top_p['provider_id']}", "GET")
    assert p_detail["id"] == top_p["provider_id"]
    print(f" -> Provider: {p_detail['business_name']}, Services count: {len(p_detail['services'])}")

    # 10. Booking Creation
    print("\n[10] Creating Service Booking")
    target_service_id = p_detail["services"][0]["service_id"] if p_detail["services"] else 2
    booking_res = make_req("/bookings", "POST", {
        "provider_id": top_p["provider_id"],
        "service_id": target_service_id,
        "customer_full_name": "Test Customer",
        "customer_mobile": "+91-9988112233",
        "customer_email": unique_cust_email,
        "booking_date": (date.today() + timedelta(days=10)).isoformat(),
        "booking_time": "14:00",
        "service_address": "15th Main, Sector 3, HSR Layout, Bengaluru",
        "special_instructions": "AC cooling coil inspection required."
    }, token=cust_token)
    booking_id = booking_res["id"]
    booking_ref = booking_res["booking_reference"]
    print(f" -> Booking Created: Reference {booking_ref}, Status: {booking_res['status']}")

    # 11. Customer views Booking Status
    print("\n[11] Customer fetching My Bookings")
    my_bookings = make_req("/bookings/my", "GET", token=cust_token)
    found_b = next((b for b in my_bookings if b["id"] == booking_id), None)
    assert found_b is not None
    assert found_b["status"] == "PENDING"
    print(f" -> Found pending booking {found_b['booking_reference']} in customer dashboard")

    # 12. Provider login to view and accept booking
    print("\n[12] Provider accepts booking")
    # Login as demo provider (Ravi Kumar) if booked with him
    prov_login_token = make_req("/auth/login", "POST", {
        "email": "provider@marketplace.com",
        "password": "ProviderPassword123!"
    })["access_token"]
    
    update_res = make_req(f"/bookings/{booking_id}/status", "PATCH", {
        "status": "ACCEPTED"
    }, token=prov_login_token)
    print(f" -> Status updated by provider to: {update_res['status']}")

    # 13. Progress & Complete Booking
    print("\n[13] Provider completes the booking")
    make_req(f"/bookings/{booking_id}/status", "PATCH", {"status": "IN_PROGRESS"}, token=prov_login_token)
    comp_res = make_req(f"/bookings/{booking_id}/status", "PATCH", {"status": "COMPLETED"}, token=prov_login_token)
    assert comp_res["status"] == "COMPLETED"
    print(" -> Job marked as COMPLETED!")

    # 14. Customer submits review & rating
    print("\n[14] Customer submits review and rating")
    rev_res = make_req("/reviews", "POST", {
        "booking_id": booking_id,
        "score": 5.0,
        "review_text": "Great service! Arrived right on time and fixed the AC cooling issue thoroughly."
    }, token=cust_token)
    print(f" -> Review posted: {rev_res['message']}")

    # 15. AI Assistant RAG Chatbot
    print("\n[15] Testing RAG AI Assistant Chatbot")
    chat_res = make_req("/assistant/chat", "POST", {
        "message": "My AC is leaking water and not cooling",
        "latitude": 12.9116,
        "longitude": 77.6389
    })
    assert chat_res["suggested_service"] is not None
    print(f" -> Suggested Service: {chat_res['suggested_service']['name']}")
    print(f" -> Suggested Providers Count: {len(chat_res['providers'])}")
    print(f" -> Assistant Response Preview: {chat_res['response'][:120]}...")

    # 16. Provider Profile & Service Management
    print("\n[16] Provider managing services & profile")
    my_p_profile = make_req("/providers/me/profile", "GET", token=prov_token)
    assert my_p_profile["email"] == unique_prov_email
    # Add service
    add_svc_res = make_req("/providers/me/services", "POST", {
        "service_id": 3, # Electrical
        "custom_price": 420.0,
        "experience_description": "Specialist in MCB wiring and home circuit repair"
    }, token=prov_token)
    print(f" -> {add_svc_res['message']}")

    # 17. Admin Dashboard Analytics
    print("\n[17] Testing Admin Dashboard Stats")
    admin_token = make_req("/auth/login", "POST", {
        "email": "admin@marketplace.com",
        "password": "AdminPassword123!"
    })["access_token"]
    admin_stats = make_req("/admin/stats", "GET", token=admin_token)
    print(f" -> Platform Analytics: Users: {admin_stats['total_users']}, Providers: {admin_stats['total_providers']}, Bookings: {admin_stats['total_bookings']}")
    assert admin_stats["total_users"] > 0

    print("\n==================================================")
    print("ALL 17 END-TO-END TESTS PASSED CLEANLY & ACCURATELY!")
    print("==================================================")

if __name__ == "__main__":
    test_full_marketplace()
