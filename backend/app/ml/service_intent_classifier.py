"""Optional inference wrapper for the local service-intent transformer."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

MODEL_DIR = Path(__file__).resolve().parents[2] / "ml_models" / "service_intent_model"
LABEL_TO_SERVICE_SLUG = {
    "ac_repair": "ac-repair",
    "cleaning": "cleaning",
    "doctor": "doctor-consultation",
    "electrical": "electrical",
    "food_delivery": "home-food",
    "plumbing": "plumbing",
    "tutoring": "tutors",
    "vehicle_repair": "car-repair",
}
_TOKENIZER = None
_MODEL = None


def _load_artifacts() -> bool:
    global _TOKENIZER, _MODEL
    if _TOKENIZER is not None and _MODEL is not None:
        return True
    if not (MODEL_DIR / "config.json").exists() or not (MODEL_DIR / "model.safetensors").exists():
        return False
    try:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        _TOKENIZER = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
        _MODEL = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR, local_files_only=True)
        _MODEL.eval()
        return True
    except Exception:
        _TOKENIZER = None
        _MODEL = None
        return False


def classify_service(query: str) -> dict:
    """Classify text without deciding provider or location eligibility."""
    if not query.strip() or not _load_artifacts():
        return {"subservice": None, "confidence": 0.0, "model_available": False}

    import torch

    encoded = _TOKENIZER(query, return_tensors="pt", truncation=True, max_length=512)
    with torch.inference_mode():
        probabilities = torch.softmax(_MODEL(**encoded).logits, dim=-1)[0]
    class_id = int(torch.argmax(probabilities).item())
    confidence = float(probabilities[class_id].item())
    label = _MODEL.config.id2label.get(class_id, str(class_id)).lower()
    return {
        "subservice": LABEL_TO_SERVICE_SLUG.get(label),
        "model_label": label,
        "confidence": round(confidence, 4),
        "model_available": True,
    }


def predict_service_slug(query: str) -> Optional[str]:
    """Return a high-confidence database service slug, or None."""
    result = classify_service(query)
    if result["confidence"] < 0.80:
        return None
    return result["subservice"]
