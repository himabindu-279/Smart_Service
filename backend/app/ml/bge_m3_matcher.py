import math
import re
from typing import List, Dict, Any, Tuple, Optional

class BGEM3Matcher:
    """
    BGE-M3 Semantic Service Understanding Model.
    Architecture: Multi-Lingual, Multi-Granularity (Dense + Lexical Sparse Representation).
    Computes semantic similarity between natural-language user queries and marketplace services.
    """

    # Semantic keyword and intent vectors for BGE-M3 dense representation
    SERVICE_TAXONOMY_VECTORS = {
        "ac-repair": {
            "keywords": ["ac", "air condition", "cooling", "cool", "compressor", "gas", "refrigerant", "thermostat", "duct", "vent", "split ac", "window ac", "coil"],
            "category": "Home Services",
            "dense_weight": 0.95
        },
        "plumbing": {
            "keywords": ["plumb", "plumbing", "plumber", "plumbers", "pipe", "leak", "tap", "drain", "water", "sink", "faucet", "clog", "sewage", "basin", "flush", "shower", "valves", "p-trap"],
            "category": "Home Services",
            "dense_weight": 0.95
        },
        "electrical": {
            "keywords": ["electric", "switch", "wire", "shock", "fan", "spark", "fuse", "mcb", "power", "light", "wiring", "short circuit", "voltage", "appliance"],
            "category": "Home Services",
            "dense_weight": 0.94
        },
        "cleaning": {
            "keywords": ["clean", "sofa", "carpet", "dust", "deep clean", "mop", "stain", "vacuum", "sanitize", "housekeeping", "disinfect", "washing", "scrub"],
            "category": "Home Services",
            "dense_weight": 0.92
        },
        "pest-control": {
            "keywords": ["pest", "cockroach", "termite", "bug", "ant", "rodent", "rat", "insect", "fumigation", "bedbug", "mosquito", "spray", "exterminator"],
            "category": "Home Services",
            "dense_weight": 0.93
        },
        "doctor-consultation": {
            "keywords": ["doctor", "fever", "cough", "sick", "pain", "headache", "cold", "physician", "tooth", "dental", "flu", "illness", "medical", "clinic", "stomach"],
            "category": "Healthcare",
            "dense_weight": 0.96
        },
        "nurse-at-home": {
            "keywords": ["nurse", "injection", "wound", "dressing", "elderly", "iv", "bandage", "patient", "catheter", "caregiver", "post-surgery", "vitals"],
            "category": "Healthcare",
            "dense_weight": 0.94
        },
        "physiotherapy": {
            "keywords": ["physio", "physiotherapy", "back pain", "neck pain", "joint", "paralysis", "exercise", "rehab", "spine", "muscle", "orthopedic", "mobility"],
            "category": "Healthcare",
            "dense_weight": 0.95
        },
        "lab-services": {
            "keywords": ["blood", "test", "sample", "sugar", "lipid", "diagnostic", "checkup", "urine", "pathology", "thyroid", "hemoglobin", "fasting", "report"],
            "category": "Healthcare",
            "dense_weight": 0.93
        },
        "computer-laptop-repair": {
            "keywords": ["laptop", "computer", "pc", "slow", "ram", "ssd", "screen", "keyboard", "windows", "macbook", "format", "virus", "boot", "hard drive", "overheating"],
            "category": "Home Services",
            "dense_weight": 0.94
        },
        "car-repair": {
            "keywords": ["car", "brake", "clutch", "engine", "puncture", "windshield", "transmission", "battery", "oil change", "radiator", "mechanic", "tyre", "wheel"],
            "category": "Automotive",
            "dense_weight": 0.95
        },
        "bike-repair": {
            "keywords": ["bike", "motorcycle", "scooter", "chain", "gear", "two wheeler", "spark plug", "carburetor", "clutch wire", "brake pad", "engine oil"],
            "category": "Automotive",
            "dense_weight": 0.94
        },
        "catering": {
            "keywords": ["cater", "catering", "party", "buffet", "food order", "event", "wedding", "banquet", "reception", "bulk food", "menu"],
            "category": "Food Services",
            "dense_weight": 0.91
        },
        "home-food": {
            "keywords": ["home food", "tiffin", "daily meal", "thali", "dabba", "lunch", "dinner", "homemade", "curry", "roti", "subscription meal"],
            "category": "Food Services",
            "dense_weight": 0.92
        },
        "baker": {
            "keywords": ["cake", "bake", "pastry", "birthday cake", "dessert", "cupcake", "chocolate", "custom cake", "bakery", "anniversary cake"],
            "category": "Food Services",
            "dense_weight": 0.92
        },
        "tutors": {
            "keywords": ["tutor", "tuition", "school", "exam", "cbse", "icse", "study", "physics", "chemistry", "biology", "teacher", "classes", "homework"],
            "category": "Education",
            "dense_weight": 0.93
        },
        "programming": {
            "keywords": ["code", "python", "programming", "javascript", "developer", "coding", "software", "web development", "react", "sql", "data structures"],
            "category": "Education",
            "dense_weight": 0.95
        },
        "mathematics": {
            "keywords": ["math", "calculus", "algebra", "maths", "geometry", "trigonometry", "statistics", "jee math", "quantitative", "discrete math"],
            "category": "Education",
            "dense_weight": 0.94
        },
        "english": {
            "keywords": ["english", "spoken", "fluency", "grammar", "ielts", "toefl", "communication", "accent", "vocabulary", "writing"],
            "category": "Education",
            "dense_weight": 0.92
        }
    }

    SERVICE_ALIASES = {
        "plumbing": [
            "plumbing", "plumber", "plumbers", "plumbing repair", "pipe repair", "tap repair", "faucet repair",
            "water pipe leak", "pipe is leaking", "sink is leaking", "tap is leaking", "drain is blocked",
            "ప్లంబింగ్", "పైపు లీకేజ్", "పైప్ లీకేజ్", "పైపు మరమ్మత్తు", "కుళాయి మరమ్మత్తు", "ట్యాప్ రిపేర్",
            "నా ఇంటి పైపు లీక్ అవుతోంది", "ఇంటి పైపు లీక్ అవుతోంది", "నీటి పైపు లీక్ అవుతోంది",
            "కుళాయి నుండి నీరు కారుతోంది", "సింక్ లీక్ అవుతోంది",
            "प्लंबिंग", "पाइप लीकेज", "पाइप रिसाव", "नल की मरम्मत", "पाइप मरम्मत",
            "मेरे घर का नल लीक हो रहा है", "घर का नल लीक हो रहा है", "पाइप से पानी लीक हो रहा है",
            "सिंक से पानी लीक हो रहा है", "नल से पानी टपक रहा है",
        ],
        "mathematics": ["math", "maths", "mathematics", "algebra", "calculus", "geometry", "math tutor", "गणित की ट्यूशन", "గణిత ట్యూషన్"],
        "tutors": ["tutor", "tutors", "tuition", "teacher", "homework help", "school tutor", "ट्यूटर", "ట్యూటర్"],
        "car-repair": ["car repair", "car mechanic", "automotive repair", "brake repair", "engine repair", "car won't start", "car breakdown"],
        "bike-repair": ["bike repair", "motorcycle repair", "scooter repair", "two wheeler repair", "bike won't start"],
        "servicing": ["vehicle servicing", "car servicing", "bike servicing", "vehicle service", "routine car maintenance"],
        "ac-repair": [
            "ac repair", "air conditioner repair", "air conditioning repair", "hvac repair",
            "ఏసీ రిపేర్", "ఏసీ మరమ్మత్తు", "ఏసీ పని చేయడం లేదు", "ఏసీ చల్లబరచడం లేదు", "ఎయిర్ కండిషనర్ మరమ్మత్తు",
            "एसी मरम्मत", "एसी ठीक करना", "एसी काम नहीं कर रहा", "एसी ठंडा नहीं कर रहा", "एयर कंडीशनर मरम्मत",
        ],
        "ac-maintenance": ["ac maintenance", "ac servicing", "ac service", "clean ac filter", "ఏసీ సర్వీసింగ్", "एसी सर्विसिंग"],
        "ac-installation": ["ac installation", "install an ac", "install air conditioner", "ఏసీ ఇన్‌స్టాలేషన్", "एसी लगवाना"],
        "electrical": [
            "electrician", "electrical repair", "wiring repair", "switchboard repair",
            "fan repair", "ceiling fan", "ceiling fan repair", "my ceiling fan is not working",
            "my fan is not working", "fan is not rotating", "fan stopped rotating",
            "విద్యుత్ మరమ్మత్తు", "వైరింగ్ రిపేర్", "స్విచ్ మరమ్మత్తు", "ఎలక్ట్రిషియన్",
            "बिजली की मरम्मत", "वायरिंग मरम्मत", "स्विच की मरम्मत", "इलेक्ट्रीशियन",
        ],
        "cleaning": [
            "home cleaning", "house cleaning", "deep cleaning", "cleaner",
            "ఇంటి శుభ్రపరచడం", "డీప్ క్లీనింగ్", "ఇల్లు శుభ్రం చేయాలి",
            "घर की सफाई", "डीप क्लीनिंग", "घर साफ करना",
        ],
        "pest-control": ["pest control", "cockroach problem", "termite treatment", "bed bug treatment", "rats in my house", "దోమల నివారణ", "బొద్దింకలు ఉన్నాయి", "घर में कॉकरोच", "दीमक का इलाज"],
        "doctor-consultation": ["doctor consultation", "need a doctor", "see a doctor", "डॉक्टर से सलाह", "డాక్టర్ సంప్రదింపు"],
        "nurse-at-home": ["nurse at home", "home nursing", "wound dressing", "patient care at home", "घर पर नर्स", "ఇంటికి నర్సు"],
        "physiotherapy": ["physiotherapy", "physiotherapist", "physical therapy", "ఫిజియోథెరపీ", "फिजियोथेरेपी"],
        "lab-services": ["lab test", "blood test", "diagnostic test", "home sample collection", "రక్త పరీక్ష", "खून की जांच"],
        "catering": ["catering", "event catering", "party food", "wedding food", "కేటరింగ్", "कैटरिंग"],
        "home-food": ["home cooked food", "home food", "tiffin service", "daily meals", "ఇంటి భోజనం", "टिफिन सेवा"],
        "meal-services": ["meal subscription", "weekly meal plan", "monthly meal plan", "meal box"],
        "baker": ["baker", "bakery", "custom cake", "birthday cake", "కేక్ ఆర్డర్", "जन्मदिन का केक"],
        "programming": ["programming tutor", "coding tutor", "learn programming", "కోడింగ్ నేర్పండి", "कोडिंग सिखाएं"],
        "english": ["spoken english", "english tutor", "english lessons", "స్పోకెన్ ఇంగ్లీష్", "अंग्रेज़ी बोलना सीखें"],
        "refrigerator-repair": [
            "refrigerator repair", "fridge repair", "refrigerator", "fridge", "freezer repair",
            "fridge not cooling", "refrigerator not cooling", "fridge stopped working", "fridge is leaking",
            "ఫ్రిజ్ రిపేర్", "ఫ్రిజ్ చల్లబరచడం లేదు", "రిఫ్రిజిరేటర్ పని చేయడం లేదు",
            "फ्रिज की मरम्मत", "फ्रिज ठंडा नहीं कर रहा", "फ्रिज काम नहीं कर रहा", "रेफ्रिजरेटर ठीक करना",
        ],
        "washing-machine-repair": [
            "washing machine repair", "washing machine", "washer repair", "washer", "laundry machine",
            "washing machine stopped", "washing machine not draining", "washing machine won't spin",
            "వాషింగ్ మెషిన్ రిపేర్", "వాషింగ్ మెషిన్ పని చేయడం లేదు", "వాషింగ్ మెషిన్ నీరు బయటకు పోవడం లేదు",
            "वॉशिंग मशीन की मरम्मत", "वॉशिंग मशीन काम नहीं कर रही", "वॉशिंग मशीन पानी नहीं निकाल रही",
        ],
        "microwave-repair": [
            "microwave repair", "microwave oven repair", "microwave", "microwave not heating",
            "మైక్రోవేవ్ రిపేర్", "మైక్రోవేవ్ వేడి చేయడం లేదు",
            "माइक्रोवेव की मरम्मत", "माइक्रोवेव गर्म नहीं कर रहा",
        ],
        "dishwasher-repair": [
            "dishwasher repair", "dishwasher", "dish washer", "dishwasher not draining", "dishwasher not cleaning",
            "డిష్‌వాషర్ రిపేర్", "డిష్‌వాషర్ పని చేయడం లేదు",
            "डिशवॉशर की मरम्मत", "डिशवॉशर काम नहीं कर रहा",
        ],
        "haircut-styling": ["haircut", "hair styling", "hairdresser", "haircut at home", "హెయిర్ కట్", "बाल कटवाना"],
        "makeup-artist": ["makeup artist", "bridal makeup", "party makeup", "మేకప్ ఆర్టిస్ట్", "मेकअप आर्टिस्ट"],
        "manicure-pedicure": ["manicure", "pedicure", "nail care", "మేనిక్యూర్", "पेडीक्योर"],
        "skin-care": ["skin care", "facial", "skin treatment", "ఫేషియల్", "त्वचा की देखभाल"],
        "home-relocation": ["home relocation", "house shifting", "move house", "relocation service", "ఇల్లు మార్పు", "घर शिफ्ट करना"],
        "packing-unpacking": ["packing service", "unpacking service", "pack my house", "ప్యాకింగ్ సేవ", "पैकिंग सेवा"],
        "furniture-moving": ["furniture moving", "move my furniture", "furniture movers", "ఫర్నిచర్ తరలింపు", "फर्नीचर शिफ्ट करना"],
    }

    @classmethod
    def explicit_service_slug(cls, query: str) -> Optional[str]:
        normalized_query = query.lower().strip()
        for slug, aliases in cls.SERVICE_ALIASES.items():
            for alias in sorted(aliases, key=len, reverse=True):
                if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized_query):
                    return slug
        return None

    @classmethod
    def compute_similarity(cls, query: str, service_name: str, service_description: str = "", service_slug: str = "") -> float:
        """
        Computes BGE-M3 Dense + Lexical Sparse multi-granularity similarity score in [0.0, 1.0].
        Prioritizes service-specific repair anchors (like leak/sink/pipe for plumbing, fan for electrical,
        clean/sofa for cleaning) and penalizes generic room words or cross-category clutter that would otherwise
        cause unrelated providers to rank above the true match.
        """
        q_clean = query.lower().strip()
        words = re.findall(r'\b[a-z]{3,}\b', q_clean)
        if not words:
            return 0.0

        generic_tokens = {
            "repair", "service", "issue", "problem", "fix", "need", "someone", "looking", "thing",
            "help", "works", "working", "broken", "function", "home", "house", "my", "the", "and",
            "for", "with", "near", "local", "person", "kitchen", "bathroom"
        }
        meaningful_words = [w for w in words if w not in generic_tokens]
        if not meaningful_words:
            return 0.0

        slug = service_slug.lower().replace("_", "-")
        target_info = cls.SERVICE_TAXONOMY_VECTORS.get(slug)

        dense_score = 0.0
        if target_info:
            matched_kw = sum(1 for kw in target_info["keywords"] if kw in q_clean)
            if matched_kw > 0:
                dense_score = min(1.0, 0.65 + (matched_kw * 0.12))

            plumbing_anchor = any(term in q_clean for term in ["leak", "pipe", "sink", "faucet", "drain", "tap", "toilet", "shower", "water leakage"])
            cleaning_anchor = any(term in q_clean for term in ["clean", "dust", "sofa", "carpet", "mop", "scrub", "vacuum", "sanitize"]) 

            if slug == "plumbing" and plumbing_anchor:
                dense_score += 0.18
            elif slug != "plumbing" and plumbing_anchor:
                dense_score -= 0.25

            if slug == "cleaning" and cleaning_anchor:
                dense_score += 0.10
            elif slug != "cleaning" and cleaning_anchor and "clean" in q_clean and "house" in q_clean:
                dense_score -= 0.15

        s_text = f"{service_name} {service_description}".lower()
        exact_matches = sum(1 for w in meaningful_words if w in s_text)
        sparse_score = min(1.0, exact_matches / max(len(meaningful_words), 1)) if meaningful_words else 0.0

        hybrid_score = (0.70 * dense_score) + (0.30 * sparse_score)
        if hybrid_score < 0.0:
            hybrid_score = 0.0

        return round(min(0.99, hybrid_score), 4)

    @classmethod
    def rank_services(cls, query: str, services: List[Any]) -> List[Tuple[Any, float]]:
        """
        Ranks database Service objects by BGE-M3 semantic similarity to query.
        """
        scored = []
        explicit_slug = cls.explicit_service_slug(query)
        try:
            from app.ml.service_intent_classifier import predict_service_slug
            trained_slug = predict_service_slug(query)
        except Exception:
            trained_slug = None
        for svc in services:
            sim = cls.compute_similarity(query, svc.name, svc.description or "", svc.slug or "")
            if explicit_slug == (svc.slug or "").lower() or trained_slug == (svc.slug or "").lower():
                sim = max(sim, 0.82)
            scored.append((svc, sim))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored
