import logging
import json
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.category import Category
from app.models.service import Service
from app.ml.bge_m3_matcher import BGEM3Matcher

logger = logging.getLogger("uvicorn.error")


class ProblemAnalyzer:
    """
    Intelligent LLM Service Problem Analyzer for the Discover entry point.
    Classifies user problem into:
    1. SIMPLE_PROBLEM / guidance: Solvable by user with step-by-step DIY guidance.
    2. PROFESSIONAL_SERVICE / service_required: Requires professional marketplace provider.
    """

    @classmethod
    async def analyze(
        cls,
        query: str,
        location: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        q = query.strip()
        q_lower = q.lower()

        # Step 1: Attempt LLM API call if key is configured
        if settings.LLM_API_KEY:
            llm_result = await cls._call_external_llm(q, location)
            if llm_result:
                cls._apply_query_overrides(llm_result, q_lower)
                # Resolve service_id against database
                cls._enrich_with_db(llm_result, db)
                return llm_result

        # Step 2: Use Built-in Intelligent Diagnostic Reasoning Engine
        analysis = cls._expert_heuristic_reasoning(q_lower, q)
        cls._enrich_with_db(analysis, db)
        return analysis

    @classmethod
    async def _call_external_llm(cls, query: str, location: Optional[str]) -> Optional[Dict[str, Any]]:
        # Check if Gemini provider or key
        is_gemini = (
            getattr(settings, "LLM_PROVIDER", "").lower() == "gemini"
            or "googleapis.com" in (getattr(settings, "LLM_BASE_URL", "") or "")
            or settings.LLM_API_KEY.startswith("AQ.")
            or settings.LLM_API_KEY.startswith("AIza")
        )

        prompt_system = (
            "You are an expert service diagnostic AI for a smart service marketplace.\n"
            "A user has described a service-related problem. Analyze the problem with these two responsibilities:\n"
            "A. If the problem is simple and can reasonably be handled by the user (e.g. AC remote battery dead, computer temp cache/restart, minor tap aerator sediment, loose bulb), "
            "set 'intent': 'guidance', 'show_providers': false, provide empathetic and practical step-by-step DIY troubleshooting guidance, and advise that professional assistance is only needed if troubleshooting fails.\n"
            "B. If the problem requires professional assistance (e.g. AC not cooling/gas leak, pipe burst/bad leakage, severe tooth pain/dental issue, sparking switch/hazard, pest infestation), "
            "set 'intent': 'service_required', 'show_providers': true, clearly identify the Category, Service, and Urgency, and explain the diagnostic reasons.\n\n"
            "Marketplace Categories:\n"
            "- Home Services\n"
            "- Healthcare\n"
            "- Food Services\n"
            "- Education\n"
            "- Automotive\n\n"
            "Marketplace Services:\n"
            "AC Repair, Plumbing, Electrical, Cleaning, Pest Control, Doctor Consultation, Nurse at Home, Physiotherapy, Lab Services, "
            "Catering, Home Food, Baker, Tutors, Programming, Mathematics, English, Car Repair, Bike Repair, Computer & Laptop Repair.\n\n"
            "Safety Guidelines:\n"
            "- Never diagnose medical conditions or suggest prescription drugs. Always advise seeing a qualified doctor or healthcare professional.\n"
            "- For electrical or dangerous problems, emphasize safety (e.g., turn off the main circuit breaker first).\n\n"
            f"User Problem: '{query}'\n"
            f"Location: '{location or 'Local'}'\n\n"
            "Return ONLY a valid JSON object matching this exact schema:\n"
            "{\n"
            '  "problem": "...",\n'
            '  "category": "Home Services" | "Healthcare" | "Food Services" | "Education" | "Automotive",\n'
            '  "service": "AC Repair" | "Plumbing" | "Electrical" | "Cleaning" | "Pest Control" | "Doctor Consultation" | "Nurse at Home" | "Physiotherapy" | "Computer & Laptop Repair" | ...,\n'
            '  "urgency": "low" | "normal" | "urgent" | "emergency",\n'
            '  "guidance": "Clear diagnostic advice...",\n'
            '  "show_providers": boolean,\n'
            '  "intent": "service_required" | "guidance",\n'
            '  "diy_steps": ["step 1", "step 2", ...]\n'
            "}"
        )

        try:
            if is_gemini:
                model_name = settings.LLM_MODEL or "gemini-3.8-flash"
                try:
                    from google import genai
                    from google.genai import types
                    client = genai.Client(api_key=settings.LLM_API_KEY)
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt_system,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.2
                        )
                    )
                    raw_text = response.text.strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text.replace("```json", "", 1).rstrip("`").strip()
                    elif raw_text.startswith("```"):
                        raw_text = raw_text.replace("```", "", 1).rstrip("`").strip()
                    parsed = json.loads(raw_text)
                    return cls._format_response(parsed, query)
                except Exception as sdk_err:
                    logger.info(f"Gemini SDK call note: {sdk_err}, attempting REST fallback...")
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.LLM_API_KEY}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt_system}]}],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.2
                        }
                    }
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        res = await client.post(url, json=payload)
                        if res.status_code == 200:
                            data = res.json()
                            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                            parsed = json.loads(raw_text)
                            return cls._format_response(parsed, query)
                        else:
                            logger.warning(f"Gemini REST returned status {res.status_code}: {res.text[:200]}")

            else:
                base_url = settings.LLM_BASE_URL or "https://api.openai.com/v1"
                headers = {
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json"
                }
                messages = [
                    {"role": "system", "content": prompt_system},
                    {"role": "user", "content": f"User Problem: '{query}'. Target Location: '{location or 'Local'}'"}
                ]
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(
                        f"{base_url}/chat/completions",
                        headers=headers,
                        json={
                            "model": settings.LLM_MODEL or "gpt-4o-mini",
                            "messages": messages,
                            "temperature": 0.2,
                            "response_format": {"type": "json_object"}
                        }
                    )
                    if res.status_code == 200:
                        data = res.json()
                        raw_text = data["choices"][0]["message"]["content"]
                        parsed = json.loads(raw_text)
                        return cls._format_response(parsed, query)
        except Exception as e:
            logger.warning(f"External LLM call failed ({e}); falling back to expert diagnostic engine.")

        return None

    @classmethod
    def _format_response(cls, parsed: Dict[str, Any], query: str) -> Dict[str, Any]:
        show_prov = parsed.get("show_providers", True)
        if "intent" not in parsed:
            parsed["intent"] = "service_required" if show_prov else "guidance"
        elif parsed["intent"] == "guidance":
            show_prov = False

        guidance_text = parsed.get("guidance", "")
        svc_name = parsed.get("service", "AC Repair")

        return {
            "problem": parsed.get("problem", query),
            "category": parsed.get("category", "Home Services"),
            "service": svc_name,
            "urgency": parsed.get("urgency", "normal"),
            "guidance": guidance_text,
            "response": guidance_text,
            "show_providers": show_prov,
            "intent": parsed.get("intent", "service_required" if show_prov else "guidance"),
            "diy_steps": parsed.get("diy_steps", []),
            "decision": "PROFESSIONAL_SERVICE" if show_prov else "SIMPLE_GUIDANCE",
            "classification": "PROFESSIONAL_SERVICE" if show_prov else "SIMPLE_PROBLEM",
            "needs_professional": show_prov,
            "problem_title": f"{svc_name} Diagnosis",
            "follow_up_prompt": (
                f"Connecting you with verified {svc_name} specialists..."
                if show_prov else
                f"Would you like to connect with a verified {svc_name} specialist if troubleshooting doesn't work?"
            )
        }

    @classmethod
    def _expert_heuristic_reasoning(cls, q_lower: str, original_query: str) -> Dict[str, Any]:
        """
        Intelligent diagnostic reasoning engine mapping real-world service problems.
        Handles the specific examples:
        - "My AC remote is not working" -> Simple problem / DIY guidance
        - "My AC is running but not cooling" -> Professional service / AC Repair
        - "My bathroom pipe is leaking" -> Professional service / Plumbing
        - "I have severe tooth pain" -> Professional service / Doctor Consultation
        - "My laptop is very slow" -> Simple problem / Computer Optimization DIY
        - "My tap is leaking" -> Minor tap drip: DIY aerator check + optional plumber
        """

        # 1. AC Remote Control Issue (Simple Problem)
        if any(term in q_lower for term in ["ac remote", "remote not working", "remote is not working", "remote control", "remote battery"]):
            guidance = (
                "Try replacing the batteries and check whether the remote display is working. "
                "You can test the remote's infrared emitter by pointing it at your smartphone camera while pressing buttons—you should see a faint purple flash on your screen. "
                "Also check if the AC turns on via its manual power button on the indoor unit. If the AC still does not respond, the indoor sensor board or remote receiver may need inspection."
            )
            diy_steps = [
                "Replace remote batteries with fresh AAA/AA alkaline cells and verify polarity (+/-)",
                "Check if the remote LCD screen turns on and digits display clearly",
                "Point the remote at your phone camera while pressing buttons to check if the infrared sensor flashes",
                "Clean the infrared transmitter lens at the tip of the remote with a soft dry cloth",
                "Try turning on the AC unit using the manual emergency power button on the indoor cabinet"
            ]
            return {
                "decision": "SIMPLE_GUIDANCE",
                "classification": "SIMPLE_PROBLEM",
                "needs_professional": False,
                "show_providers": False,
                "intent": "guidance",
                "problem": original_query,
                "problem_title": "AC Remote Control Issue",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Would you like to find an AC technician nearby if the remote or indoor sensor still does not respond?",
                "category": "Home Services",
                "service": "AC Repair",
                "urgency": "low"
            }

        # 2. AC Running But Not Cooling (Professional Service)
        if any(term in q_lower for term in ["not cooling", "running but not cooling", "cooling properly", "no cool air", "gas leak", "compressor not running", "compressor sound"]):
            guidance = (
                "This may require an AC inspection. Common causes include low refrigerant (gas leakage), "
                "heavily clogged evaporator coils, a faulty capacitor, or compressor-related problems. "
                "While waiting for a professional, verify that the remote mode is set to 'Cool' at 22°C–24°C and check for heavy dust on the air filters."
            )
            diy_steps = [
                "Verify the remote mode is set to 'Cool' with temperature at 22°C–24°C",
                "Check if the indoor air filter has heavy dust build-up",
                "Ensure outdoor condenser airflow is unobstructed"
            ]
            return {
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "needs_professional": True,
                "show_providers": True,
                "intent": "service_required",
                "problem": original_query,
                "problem_title": "AC Cooling Inefficiency & Refrigerant Inspection",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Connecting you with verified AC repair technicians nearby...",
                "category": "Home Services",
                "service": "AC Repair",
                "urgency": "urgent"
            }

        # 3. Sink / Pipe Leak (Professional Service)
        if any(term in q_lower for term in [
            "kitchen sink is leaking", "sink is leaking", "sink leaking", "leaking sink", "pipe is leaking",
            "bathroom pipe", "pipe leaking", "pipe burst", "pipe leakage", "water leaking from pipe", "water leaking from sink",
            "seepage", "drain leak", "faucet leaking", "faucet leak", "toilet leak", "leaking toilet"
        ]):
            guidance = (
                "A leaking sink, faucet, or pipe requires professional plumbing assistance to prevent concealed wall seepage, "
                "cabinet damage, and structural water damage. Please shut off the main water valve to halt active water flow. "
                "A verified plumber will inspect the joints, supply lines, and fittings to seal or replace the damaged section."
            )
            diy_steps = [
                "Locate and close the main bathroom shutoff valve to stop active water flooding",
                "Place a bucket or towels under the dripping section to protect surrounding surfaces"
            ]
            return {
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "needs_professional": True,
                "show_providers": True,
                "intent": "service_required",
                "problem": original_query,
                "problem_title": "Bathroom Pipe Leakage & Water Pressure Line Repair",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Matching verified plumbing specialists near your location...",
                "category": "Home Services",
                "service": "Plumbing",
                "urgency": "emergency"
            }

        # 4. Severe Tooth Pain / Dental Emergency (Professional Service)
        if any(term in q_lower for term in ["tooth pain", "toothache", "teeth pain", "severe tooth", "dental pain", "gum swelling", "cavity pain"]):
            guidance = (
                "Severe tooth pain typically points to deep tooth decay, pulpitis, nerve inflammation, or an active dental abscess. "
                "Over-the-counter painkillers only temporarily mask the symptoms. A licensed dental surgeon or physician should perform "
                "an oral examination, review dental X-rays, and prescribe appropriate treatment."
            )
            diy_steps = [
                "Rinse gently with warm salt water to reduce oral bacterial load",
                "Avoid very hot, cold, or sugary foods on the affected tooth",
                "Do not place aspirin directly against the gums as it can burn oral tissues"
            ]
            return {
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "needs_professional": True,
                "show_providers": True,
                "intent": "service_required",
                "problem": original_query,
                "problem_title": "Acute Dental Pain & Oral Health Diagnosis",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Connecting you with verified healthcare doctors and dental consultation providers...",
                "category": "Healthcare",
                "service": "Doctor Consultation",
                "urgency": "urgent"
            }

        # 5. Laptop Very Slow / Performance Degradation (Simple Problem)
        if any(term in q_lower for term in ["laptop is very slow", "laptop slow", "computer slow", "pc slow", "laptop hanging", "computer is very slow", "system slow"]):
            guidance = (
                "Before calling a computer technician, you can try several quick software optimizations. "
                "Restart the laptop, close heavy background apps in Task Manager, check available disk space on Drive C (keep at least 15% free), "
                "and run a quick malware scan. If the slowness persists, it could be a failing hard drive (HDD) or insufficient RAM requiring a hardware upgrade."
            )
            diy_steps = [
                "Perform a complete system restart to clear RAM memory cache and background hung tasks",
                "Open Task Manager (Ctrl + Shift + Esc) and end processes using excessive CPU or Memory",
                "Check Drive C: storage capacity and uninstall unused apps or delete temporary files (run '%temp%')",
                "Disable high-impact startup applications in Task Manager -> Startup tab",
                "Run Windows Defender or your installed antivirus to rule out background malware"
            ]
            return {
                "decision": "SIMPLE_GUIDANCE",
                "classification": "SIMPLE_PROBLEM",
                "needs_professional": False,
                "show_providers": False,
                "intent": "guidance",
                "problem": original_query,
                "problem_title": "Laptop Performance Optimization & Cleanup",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Would you like to find a computer hardware specialist nearby for SSD/RAM upgrades or OS reinstallation?",
                "category": "Home Services",
                "service": "Computer & Laptop Repair",
                "urgency": "low"
            }

        # 6. Tap Leaking / Minor Tap Drip (Simple / Hybrid Problem)
        if any(term in q_lower for term in ["tap is leaking", "tap leaking", "faucet leaking", "tap dripping", "faucet dripping"]):
            guidance = (
                "If the leak is a minor drip from the aerator nozzle, it is often caused by mineral scale or a loose screw-on cap. "
                "You can unscrew the aerator nozzle by hand, rinse the mesh filter under clean water, and hand-tighten the fixture. "
                "However, if water leaks continuously from the base or handle spindle, the internal rubber washer or ceramic cartridge has deteriorated and requires replacement."
            )
            diy_steps = [
                "Gently unscrew the tap aerator nozzle at the spout tip and rinse out mineral sediment",
                "Check if the tap handle is fully shut without over-forcing the valve",
                "Observe whether the leak originates from the spout (washer issue) or the handle base (cartridge seal)"
            ]
            return {
                "decision": "SIMPLE_GUIDANCE",
                "classification": "SIMPLE_PROBLEM",
                "needs_professional": False,
                "show_providers": False,
                "intent": "guidance",
                "problem": original_query,
                "problem_title": "Tap Dripping & Aerator Inspection",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Would you like to connect with a plumber nearby to replace worn cartridges or washers?",
                "category": "Home Services",
                "service": "Plumbing",
                "urgency": "low"
            }

        # 7. Fan Repair / Installation (Professional Electrical Service)
        # A plain fan issue is electrical work; only an explicitly named AC fan
        # should be routed to the HVAC services.
        fan_terms = ["fan", "ceiling fan", "table fan", "exhaust fan", "fan regulator"]
        if any(term in q_lower for term in fan_terms) and not any(
            term in q_lower for term in ["ac", "air conditioner", "air conditioning"]
        ):
            guidance = (
                "A fan that does not start, runs slowly, makes noise, or has a faulty regulator may have an issue with its power supply, capacitor, wiring, or motor. "
                "Switch off the circuit before inspecting it and have a qualified electrician test the wiring and components."
            )
            return {
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "needs_professional": True,
                "show_providers": True,
                "intent": "service_required",
                "problem": original_query,
                "problem_title": "Fan Repair & Electrical Inspection",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": [
                    "Turn off the fan switch and the relevant circuit breaker",
                    "Do not open the motor housing or touch exposed wiring",
                    "Book a qualified electrician to inspect the capacitor, regulator, wiring, and motor"
                ],
                "follow_up_prompt": "Connecting you with verified electrical specialists near you...",
                "category": "Home Services",
                "service": "Electrical",
                "urgency": "normal"
            }

        # 8. Electrical Sparking / Short Circuit (Professional Service - Critical Hazard)
        if any(term in q_lower for term in ["spark", "sparking", "short circuit", "burning smell", "shock", "mcb trip"]):
            guidance = (
                "Sparking switchboards, burning smells, or continuous MCB tripping represent serious electrical hazards. "
                "Immediately switch off the main circuit breaker controlling that area. Do not touch exposed terminals. "
                "A certified electrician must inspect the internal wiring, insulation resistance, and replace damaged MCBs or sockets."
            )
            diy_steps = [
                "Immediately switch off the respective room breaker or main distribution board breaker",
                "Unplug all high-draw appliances (heaters, irons, kettles) from that circuit"
            ]
            return {
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "needs_professional": True,
                "show_providers": True,
                "intent": "service_required",
                "problem": original_query,
                "problem_title": "Electrical Short Circuit & Hazard Risk",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Dispatching emergency verified electrical specialists near you...",
                "category": "Home Services",
                "service": "Electrical",
                "urgency": "emergency"
            }

        # 8. Fever / Medical Symptoms (Professional Service)
        if any(term in q_lower for term in ["fever", "cough", "vomit", "chest pain", "breathing", "doctor", "physician", "blood test"]):
            guidance = (
                "Persistent symptoms like high fever, severe cough, or acute illness require proper clinical evaluation. "
                "A licensed physician will assess vital signs, diagnose the root infection, and prescribe appropriate therapy."
            )
            diy_steps = [
                "Keep hydrated with fluids and electrolytes",
                "Monitor body temperature using a digital thermometer"
            ]
            return {
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "needs_professional": True,
                "show_providers": True,
                "intent": "service_required",
                "problem": original_query,
                "problem_title": "Medical Consultation & Clinical Assessment",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Connecting with verified medical consultation doctors...",
                "category": "Healthcare",
                "service": "Doctor Consultation",
                "urgency": "urgent"
            }

        # 9. General AC Maintenance
        if "ac" in q_lower and any(term in q_lower for term in ["service", "servicing", "maintenance", "smell", "clean filter"]):
            guidance = (
                "Foul odors, reduced airflow, or seasonal maintenance require chemical foam jet cleaning of the indoor evaporator "
                "and outdoor condenser coils, blower wheel sanitization, and drain tray unblocking."
            )
            diy_steps = ["Turn off AC and clean the front mesh filters with running tap water"]
            return {
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "needs_professional": True,
                "show_providers": True,
                "intent": "service_required",
                "problem": original_query,
                "problem_title": "AC Preventive Maintenance & Deep Cleaning",
                "guidance": guidance,
                "response": guidance,
                "diy_steps": diy_steps,
                "follow_up_prompt": "Matching verified AC service professionals near you...",
                "category": "Home Services",
                "service": "AC Repair",
                "urgency": "normal"
            }

        # Default Fallback
        guidance = (
            f"Based on your description ('{original_query}'), our AI diagnostic system has identified that verified marketplace "
            f"service will provide reliable, safe, and professional resolution."
        )
        return {
            "decision": "PROFESSIONAL_SERVICE",
            "classification": "PROFESSIONAL_SERVICE",
            "needs_professional": True,
            "show_providers": True,
            "intent": "service_required",
            "problem": original_query,
            "problem_title": f"Service Assistance: {original_query[:40]}",
            "guidance": guidance,
            "response": guidance,
            "diy_steps": [],
            "follow_up_prompt": "Matching verified specialists in your area...",
            "category": "Home Services",
            "service": "AC Repair",
            "urgency": "normal"
        }

    @classmethod
    def _enrich_with_db(cls, analysis: Dict[str, Any], db: Session):
        if not db:
            return

        if analysis.get("show_providers") is False and analysis.get("intent") == "guidance":
            return

        query_text = str(analysis.get("problem") or analysis.get("service") or "").strip()
        if not query_text:
            return

        services = db.query(Service).filter(Service.is_active == True).all()
        if not services:
            return

        ranked = BGEM3Matcher.rank_services(query_text, services)
        matched_service = None
        matched_score = 0.0
        for service, score in ranked:
            if score >= 0.58:
                matched_service = service
                matched_score = score
                break

        if matched_service:
            analysis["service_id"] = matched_service.id
            analysis["service"] = matched_service.name
            analysis["service_match_score"] = round(matched_score, 3)
            if matched_service.category:
                analysis["category"] = matched_service.category.name
                analysis["category_id"] = matched_service.category.id
            analysis["show_providers"] = True
            analysis["needs_professional"] = True
            analysis["intent"] = "service_required"
            analysis["decision"] = "PROFESSIONAL_SERVICE"
            analysis["classification"] = "PROFESSIONAL_SERVICE"
            return

        analysis["service_id"] = None
        analysis["service"] = None
        analysis["category"] = None
        analysis["category_id"] = None
        analysis["service_match_score"] = 0.0
        analysis["show_providers"] = False
        analysis["needs_professional"] = False
        analysis["intent"] = "no_match"
        analysis["decision"] = "NO_MATCH"
        analysis["classification"] = "NO_MATCH"
        analysis["message"] = (
            "No marketplace service matches this problem closely enough. "
            "Please describe the issue using a supported service category or a more specific fault."
        )

    @classmethod
    def _apply_query_overrides(cls, analysis: Dict[str, Any], q_lower: str):
        """Correct high-confidence safety/service mappings before database enrichment."""
        leaking_terms = [
            "leaking sink", "sink is leaking", "kitchen sink is leaking", "water leaking from sink",
            "leaking pipe", "pipe leaking", "faucet leaking", "tap is leaking", "drain leak",
            "toilet leak", "toilet is leaking", "sink leak", "pipe is leaking", "water leak"
        ]
        if any(term in q_lower for term in leaking_terms):
            analysis.update({
                "category": "Home Services",
                "service": "Plumbing",
                "show_providers": True,
                "needs_professional": True,
                "intent": "service_required",
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "follow_up_prompt": "Connecting you with verified plumbing specialists near you..."
            })
            return

        fan_terms = ["fan", "ceiling fan", "table fan", "exhaust fan", "fan regulator"]
        has_fan = any(term in q_lower for term in fan_terms)
        mentions_ac = any(term in q_lower for term in ["ac", "air conditioner", "air conditioning"])
        if has_fan and not mentions_ac:
            analysis.update({
                "category": "Home Services",
                "service": "Electrical",
                "show_providers": True,
                "needs_professional": True,
                "intent": "service_required",
                "decision": "PROFESSIONAL_SERVICE",
                "classification": "PROFESSIONAL_SERVICE",
                "follow_up_prompt": "Connecting you with verified electrical specialists near you..."
            })
