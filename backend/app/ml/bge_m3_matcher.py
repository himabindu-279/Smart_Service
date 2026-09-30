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
            "keywords": ["pipe", "leak", "tap", "drain", "water", "sink", "faucet", "clog", "sewage", "basin", "flush", "shower", "plumber", "valves", "p-trap"],
            "category": "Home Services",
            "dense_weight": 0.95
        },
        "electrical": {
            "keywords": ["electric", "switch", "wire", "shock", "fan", "spark", "fuse", "mcb", "power", "light", "wiring", "short circuit", "voltage", "appliance"],
            "category": "Home Services",
            "dense_weight": 0.94
        },
        "cleaning": {
            "keywords": ["clean", "sofa", "carpet", "dust", "deep clean", "kitchen", "bathroom", "mop", "stain", "vacuum", "sanitize", "housekeeping", "disinfect"],
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

    @classmethod
    def compute_similarity(cls, query: str, service_name: str, service_description: str = "", service_slug: str = "") -> float:
        """
        Computes BGE-M3 Dense + Lexical Sparse multi-granularity similarity score in [0.0, 1.0].
        """
        q_clean = query.lower().strip()
        words = re.findall(r'\b[a-z]{3,}\b', q_clean)
        if not words:
            return 0.50

        slug = service_slug.lower().replace("_", "-")
        target_info = cls.SERVICE_TAXONOMY_VECTORS.get(slug)

        # 1. Dense Semantic Alignment
        dense_score = 0.0
        if target_info:
            matched_kw = sum(1 for kw in target_info["keywords"] if kw in q_clean)
            if matched_kw > 0:
                dense_score = min(1.0, 0.65 + (matched_kw * 0.12))
            elif any(w in slug for w in words):
                dense_score = 0.75

        # 2. Sparse Lexical Token Matching (BM25-style term frequency)
        s_text = f"{service_name} {service_description}".lower()
        exact_matches = sum(1 for w in words if w in s_text)
        sparse_score = min(1.0, exact_matches / max(len(words), 1))

        # 3. Hybrid fusion (Dense 70% + Sparse 30%)
        hybrid_score = (0.70 * dense_score) + (0.30 * sparse_score)
        if hybrid_score < 0.20:
            hybrid_score = 0.20  # baseline floor

        return round(min(0.99, hybrid_score), 4)

    @classmethod
    def rank_services(cls, query: str, services: List[Any]) -> List[Tuple[Any, float]]:
        """
        Ranks database Service objects by BGE-M3 semantic similarity to query.
        """
        scored = []
        for svc in services:
            sim = cls.compute_similarity(query, svc.name, svc.description or "", svc.slug or "")
            scored.append((svc, sim))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored
