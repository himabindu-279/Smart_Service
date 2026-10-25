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
from app.models.enums import ServiceApprovalStatus
from app.ml.bge_m3_matcher import BGEM3Matcher
from app.utils.geo import geocode_location, haversine_distance

logger = logging.getLogger("uvicorn.error")


class AssistantService:
    @staticmethod
    async def process_chat(
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        user_lat: Optional[float] = None,
        user_lon: Optional[float] = None,
        location: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        RAG AI Assistant pipeline:
        1. User message -> Retrieve matched services & providers from DB
        2. Construct grounded context
        3. Query LLM (if configured) or intelligent contextual RAG synthesizer
        4. Return response with verified actionable marketplace suggestions
        """
        q = message.strip()
        llm_called = False
        llm_status = "not_attempted"
        llm_error = None
        if not q:
            return {
                "response": "Tell me what is happening or what kind of service you need, and I’ll help find the right next step.",
                "suggested_service": None,
                "providers": [],
                "actions": [],
                "llm_called": False,
                "llm_status": "not_needed",
            }

        history = [
            item for item in (history or [])
            if item.get("role") in {"user", "assistant"} and item.get("content", "").strip()
        ][-6:]
        target_lat = user_lat
        target_lon = user_lon
        location_label = location
        if (target_lat is None or target_lon is None) and location:
            matches = geocode_location(location)
            if matches:
                target_lat = matches[0]["latitude"]
                target_lon = matches[0]["longitude"]
                location_label = matches[0]["display_name"]

        services = db.query(Service).filter(Service.is_active == True).all()
        ranked_services = BGEM3Matcher.rank_services(q, services)
        top_service, confidence = ranked_services[0] if ranked_services else (None, 0.0)
        if confidence < 0.48:
            top_service = None

        if top_service is None and history:
            for item in reversed(history):
                if item["role"] != "user":
                    continue
                contextual_ranking = BGEM3Matcher.rank_services(item["content"], services)
                contextual_service, contextual_confidence = contextual_ranking[0] if contextual_ranking else (None, 0.0)
                if contextual_confidence >= 0.48:
                    top_service = contextual_service
                    confidence = contextual_confidence
                    logger.info("Resolved follow-up '%s' from service context '%s'", q, item["content"])
                    break

        if top_service is None:
            return {
                "response": (
                    "I can help with home repairs, healthcare, food, education, and vehicle services. "
                    "What is the specific problem or outcome you need help with?"
                ),
                "suggested_service": None,
                "providers": [],
                "actions": [{"label": "Browse services", "type": "NAVIGATE", "path": "/services"}],
                "llm_called": False,
                "llm_status": "not_needed",
            }

        # Step 2: Retrieve approved offers from active, available users.
        relevant_providers = []
        ps_records = []
        if target_lat is not None and target_lon is not None:
            ps_records = (
                db.query(ProviderService, Provider, User)
                .join(Provider, ProviderService.provider_id == Provider.id)
                .join(User, Provider.user_id == User.id)
                .filter(
                    ProviderService.service_id == top_service.id,
                    ProviderService.is_active == True,
                    ProviderService.status == ServiceApprovalStatus.APPROVED,
                    Provider.is_available == True,
                    User.is_active == True,
                )
                .all()
            )

        for provider_service, provider, provider_user in ps_records:
            distance = None
            if target_lat is not None and target_lon is not None:
                if provider.latitude is None or provider.longitude is None:
                    continue
                distance = haversine_distance(target_lat, target_lon, provider.latitude, provider.longitude)
                service_radius = provider_service.service_radius_km or 50
                if distance > min(50, service_radius):
                    continue

            relevant_providers.append({
                "id": provider.id,
                "name": provider_user.full_name,
                "business_name": provider.business_name or provider_user.full_name,
                "rating": provider.rating_avg,
                "total_ratings": provider.total_ratings,
                "price": provider_service.custom_price or top_service.base_price,
                "distance_km": distance,
                "address": provider_service.service_location or provider.address,
                "experience_years": provider.experience_years,
                "is_verified": provider.is_verified,
            })

        relevant_providers.sort(
            key=lambda provider: provider["distance_km"] if provider["distance_km"] is not None else float("inf")
        )

        # Step 3: LLM generation or contextual synthesis from verified facts.
        llm_response = None
        if settings.LLM_API_KEY:
            llm_called = True
            llm_status = "requesting"
            try:
                base_url = settings.LLM_BASE_URL or "https://api.openai.com/v1"
                headers = {
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json"
                }

                provider_context = [
                    {
                        "business_name": provider["business_name"],
                        "rating": provider["rating"],
                        "distance_km": provider["distance_km"],
                        "price": provider["price"],
                        "verified": provider["is_verified"],
                        "address": provider["address"],
                    }
                    for provider in relevant_providers[:3]
                ]
                system_prompt = (
                    "You are the Smart Service Marketplace assistant. Be clear, useful, calm, and concise. "
                    "Answer the user's actual question first. Do not claim a medical diagnosis; advise qualified care for medical concerns. "
                    "For electrical hazards, give immediate safety advice before suggesting a booking. "
                    "Only use the marketplace facts below. Never invent services, prices, providers, ratings, distances, availability, or location coverage. "
                    "Only call a provider verified when its verified field is true. If there are no local provider records, say so plainly. "
                    "If the message does not clearly match a service, ask one short clarifying question instead of guessing. "
                    "Use short paragraphs or bullets, avoid repetitive introductions, and do not mention internal models or technical systems.\n"
                    f"User's request: {q}\n"
                    f"Matched service: {top_service.name}\n"
                    f"Category: {top_service.category.name if top_service.category else 'Marketplace service'}\n"
                    f"Service details: {top_service.description or 'No additional description provided.'}\n"
                    f"Catalog starting price: ₹{top_service.base_price}\n"
                    f"Typical duration: {top_service.estimated_duration_minutes or 'Not specified'} minutes\n"
                    f"User-selected location: {location_label or 'Not provided'}\n"
                    f"User coordinates available: {target_lat is not None and target_lon is not None}\n"
                    f"Matching approved local offers: {provider_context}\n"
                )

                messages = [{"role": "system", "content": system_prompt}]
                if history:
                    for h in history[-4:]:
                        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
                messages.append({"role": "user", "content": message})

                async with httpx.AsyncClient(timeout=3.5) as client:
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
                            llm_status = "success"
                        else:
                            llm_status = "provider_error"
                            llm_error = f"HTTP {resp.status_code}"
                            logger.warning(
                                "Gemini assistant returned HTTP %s: %s",
                                resp.status_code,
                                resp.text[:250],
                            )
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
                            llm_status = "success"
                        else:
                            llm_status = "provider_error"
                            llm_error = f"HTTP {resp.status_code}"
                            logger.warning(
                                "LLM assistant returned HTTP %s: %s",
                                resp.status_code,
                                resp.text[:250],
                            )
            except Exception as e:
                llm_status = "timeout" if isinstance(e, httpx.TimeoutException) else "error"
                llm_error = type(e).__name__
                logger.warning("External LLM call failed (%s: %s); using grounded catalog synthesis.", type(e).__name__, str(e)[:180])
        else:
            llm_status = "not_configured"
            logger.info("LLM response skipped because no API key is configured; using grounded catalog synthesis.")

        if not llm_response:
            category_name = top_service.category.name if top_service.category else "Services"
            provider = relevant_providers[0] if relevant_providers else None
            if provider:
                verification = "verified " if provider["is_verified"] else ""
                rating = f", rated {provider['rating']:.1f}/5" if provider["rating"] else ""
                price = f", from ₹{provider['price']:.0f}" if provider["price"] else ""
                provider_summary = (
                    f"Closest matching offer: **{provider['business_name']}**, {verification}provider"
                    f"{rating}, {provider['distance_km']:.1f} km away{price}."
                )
            elif target_lat is None or target_lon is None:
                provider_summary = "Set your service location in Discover or your profile to see providers serving your area."
            else:
                area = location_label or location or "your selected area"
                provider_summary = f"No approved provider for this service was found within the service area around {area}."

            llm_response = (
                f"**{top_service.name}** is the closest match in {category_name}.\n\n"
                f"{top_service.description or 'A specialist can assess the issue and recommend the appropriate next step.'}\n\n"
                f"A typical appointment takes about {top_service.estimated_duration_minutes or 'an hour'} minutes; "
                f"the catalog starting price is ₹{top_service.base_price:.0f}. Final pricing may vary by provider.\n\n"
                f"{provider_summary}"
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

        actions = []
        if top_service:
            category_slug = top_service.category.slug if top_service.category else ""
            actions.append({
                "label": f"View {top_service.name}",
                "type": "NAVIGATE",
                "path": f"/services/{category_slug}/{top_service.slug}",
            })
            if target_lat is not None and target_lon is not None:
                actions.append({
                    "label": "View nearby providers",
                    "type": "NAVIGATE",
                    "path": f"/maps?service={top_service.id}",
                })
        else:
            actions.append({"label": "Browse services", "type": "NAVIGATE", "path": "/services"})

        return {
            "response": llm_response,
            "suggested_service": suggested_service,
            "providers": relevant_providers[:3],
            "actions": actions,
            "llm_called": llm_called,
            "llm_status": llm_status,
            "llm_error": llm_error,
        }
