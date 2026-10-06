import logging
import httpx
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.category import Category
from app.models.service import Service
from app.models.provider import Provider
from app.models.provider_service import ProviderService
from app.models.user import User
from app.utils.geo import haversine_distance

logger = logging.getLogger("uvicorn.error")


class AssistantService:
    @staticmethod
    async def process_chat(
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        user_lat: Optional[float] = None,
        user_lon: Optional[float] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        RAG AI Assistant pipeline:
        1. User message -> Retrieve matched services & providers from DB
        2. Construct grounded context
        3. Query LLM (if configured) or intelligent contextual RAG synthesizer
        4. Return response with verified actionable marketplace suggestions
        """
        q = message.lower().strip()

        # Step 1: Query database for all active services
        all_services = db.query(Service).filter(Service.is_active == True).all()

        # Scoring relevance
        scored_services = []
        for svc in all_services:
            name_words = svc.name.lower().split()
            desc_words = (svc.description or "").lower().split()
            cat_words = svc.category.name.lower().split() if svc.category else []

            score = 0
            for word in name_words:
                if len(word) > 2 and word in q:
                    score += 5
            for word in cat_words:
                if len(word) > 2 and word in q:
                    score += 3
            for word in desc_words:
                if len(word) > 3 and word in q:
                    score += 1

            # Common symptom keywords
            symptom_map = {
                "ac-repair": ["ac", "air condition", "cooling", "cool", "heat", "compressor", "gas", "smell", "vent"],
                "plumbing": ["leak", "pipe", "tap", "drain", "water", "sink", "faucet", "clog", "overflow"],
                "electrical": ["switch", "wire", "shock", "fan", "spark", "fuse", "mcb", "power", "light"],
                "cleaning": ["clean", "sofa", "carpet", "dust", "deep clean", "kitchen", "bathroom"],
                "pest-control": ["pest", "cockroach", "termite", "bug", "ant", "rodent", "rat", "insect"],
                "doctor-consultation": ["doctor", "fever", "cough", "sick", "pain", "headache", "cold", "physician"],
                "nurse-at-home": ["nurse", "injection", "wound", "dressing", "elderly", "iv", "bandage"],
                "physiotherapy": ["physio", "back pain", "neck pain", "joint", "paralysis", "exercise", "rehab"],
                "lab-services": ["blood", "test", "sample", "sugar", "lipid", "diagnostic", "checkup"],
                "catering": ["cater", "party", "buffet", "food order", "event", "wedding"],
                "home-food": ["home food", "tiffin", "daily meal", "thali", "dabba", "lunch"],
                "baker": ["cake", "bake", "pastry", "birthday cake", "dessert"],
                "tutors": ["tutor", "tuition", "school", "exam", "cbse", "icse", "study"],
                "programming": ["code", "python", "programming", "javascript", "developer", "coding", "software"],
                "mathematics": ["math", "calculus", "algebra", "maths", "geometry"],
                "english": ["english", "spoken", "fluency", "grammar", "ielts", "toefl"],
                "car-repair": ["car", "brake", "clutch", "engine", "puncture", "windshield"],
                "bike-repair": ["bike", "motorcycle", "scooter", "chain", "gear", "two wheeler"],
                "servicing": ["servicing", "service", "maintenance", "oil change", "wash"]
            }

            for slug_key, keywords in symptom_map.items():
                if svc.slug == slug_key:
                    for kw in keywords:
                        if kw in q:
                            score += 4

            if score > 0:
                scored_services.append((score, svc))

        scored_services.sort(key=lambda x: x[0], reverse=True)

        top_service = scored_services[0][1] if scored_services else None
        if not top_service and all_services:
            top_service = all_services[0]  # Fallback

        # Step 2: Retrieve real providers from DB offering this service
        relevant_providers = []
        if top_service:
            ps_records = (
                db.query(ProviderService, Provider, User)
                .join(Provider, ProviderService.provider_id == Provider.id)
                .join(User, Provider.user_id == User.id)
                .filter(
                    ProviderService.service_id == top_service.id,
                    ProviderService.is_active == True,
                    Provider.is_available == True
                )
                .all()
            )

            for ps, p, u in ps_records:
                dist = 3.5
                if user_lat and user_lon and p.latitude and p.longitude:
                    dist = haversine_distance(user_lat, user_lon, p.latitude, p.longitude)

                relevant_providers.append({
                    "id": p.id,
                    "name": u.full_name,
                    "business_name": p.business_name or u.full_name,
                    "rating": p.rating_avg or 4.8,
                    "total_ratings": p.total_ratings or 20,
                    "price": ps.custom_price,
                    "distance_km": dist,
                    "address": p.address or "Bengaluru",
                    "experience_years": p.experience_years,
                    "is_verified": p.is_verified
                })

            relevant_providers.sort(key=lambda x: x["distance_km"])

        # Step 3: LLM generation or contextual synthesis
        llm_response = None
        if settings.LLM_API_KEY:
            try:
                base_url = settings.LLM_BASE_URL or "https://api.openai.com/v1"
                headers = {
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json"
                }

                system_prompt = (
                    "You are SmartService AI Assistant, a helpful customer service consultant for the "
                    "Smart Service Marketplace. "
                    "Based on the user's issue, diagnose their requirement and recommend the appropriate marketplace service.\n"
                    f"Identified Relevant Service: {top_service.name if top_service else 'General Maintenance'} "
                    f"({top_service.category.name if top_service and top_service.category else ''})\n"
                    f"Service Description: {top_service.description if top_service else ''}\n"
                    f"Base Price: ₹{top_service.base_price if top_service else 500}\n"
                    f"Top Verified Specialists near the user's location: {', '.join([p['business_name'] for p in relevant_providers[:2]])}\n"
                    "Guidance: Be warm, professional, diagnostic, and concise. Explain what the technician will inspect. "
                    "Tell the user they can book right away from Discover or check nearby locations on Maps."
                )

                messages = [{"role": "system", "content": system_prompt}]
                if history:
                    for h in history[-4:]:
                        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
                messages.append({"role": "user", "content": message})

                async with httpx.AsyncClient(timeout=15.0) as client:
                    if settings.LLM_PROVIDER.lower() == "gemini":
                        gemini_url = (
                            f"{base_url.rstrip('/')}/models/{settings.LLM_MODEL}:generateContent"
                            f"?key={settings.LLM_API_KEY}"
                        )
                        gemini_contents = [
                            {
                                "role": "user" if item["role"] == "user" else "model",
                                "parts": [{"text": item["content"]}]
                            }
                            for item in messages if item["role"] != "system"
                        ]
                        resp = await client.post(
                            gemini_url,
                            headers={"Content-Type": "application/json"},
                            json={
                                "systemInstruction": {"parts": [{"text": system_prompt}]},
                                "contents": gemini_contents,
                                "generationConfig": {"temperature": 0.4}
                            }
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            llm_response = data["candidates"][0]["content"]["parts"][0]["text"]
                    else:
                        resp = await client.post(
                            f"{base_url}/chat/completions",
                            headers=headers,
                            json={
                                "model": settings.LLM_MODEL,
                                "messages": messages,
                                "temperature": 0.4
                            }
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            llm_response = data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.warning(f"External LLM call failed ({e}), using intelligent contextual synthesis.")

        if not llm_response:
            # Deterministic, rich contextual RAG synthesis
            if top_service:
                cat_name = top_service.category.name if top_service.category else "Services"
                best_provider = relevant_providers[0] if relevant_providers else None
                provider_mention = (
                    f" I recommend verified specialist **{best_provider['business_name']}** "
                    f"({best_provider['rating']}★, {best_provider['distance_km']} km away) starting at ₹{best_provider['price']}."
                    if best_provider else ""
                )

                llm_response = (
                    f"Based on your description, this issue is closely related to **{top_service.name}** under **{cat_name}**.\n\n"
                    f"{top_service.description}\n\n"
                    f"**Typical Service Inspection:**\n"
                    f"• Diagnostic check and symptom root-cause evaluation\n"
                    f"• Standard duration: ~{top_service.estimated_duration_minutes} minutes\n"
                    f"• Standard starting rate: ₹{top_service.base_price}\n\n"
                    f"{provider_mention}\n\n"
                    f"You can explore matching providers in **Discover**, view proximity on **Maps**, or click below to schedule an appointment."
                )
            else:
                llm_response = (
                    "I can help you connect with verified service professionals across Bengaluru in Home Services (Plumbing, AC, Electrical, Cleaning), "
                    "Healthcare (Doctors, Nurses, Physiotherapy), Food, Education, and Automotive. Could you tell me a little more about what you need assistance with?"
                )

        # Actions & Suggestions
        suggested_service = None
        if top_service:
            suggested_service = {
                "id": top_service.id,
                "name": top_service.name,
                "category": top_service.category.name if top_service.category else None,
                "base_price": top_service.base_price,
                "slug": top_service.slug
            }

        return {
            "response": llm_response,
            "suggested_service": suggested_service,
            "providers": relevant_providers[:3],
            "actions": [
                {
                    "label": f"Find {top_service.name} on Discover" if top_service else "Search Discover",
                    "type": "NAVIGATE",
                    "path": f"/discover?search={top_service.name}" if top_service else "/discover"
                },
                {
                    "label": f"View Nearby on Maps" if top_service else "Explore Maps",
                    "type": "NAVIGATE",
                    "path": f"/maps?service={top_service.id}" if top_service else "/maps"
                }
            ]
        }
