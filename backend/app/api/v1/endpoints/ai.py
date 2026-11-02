import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_optional_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.booking import Booking
from app.models.enums import UserRole
from app.models.problem_image import ProblemImage
from app.models.provider import Provider
from app.models.user import User
from app.services.problem_analyzer import ProblemAnalyzer
from app.ml.recommendation_engine import RecommendationEngine

router = APIRouter()


class ServiceUnderstandingRequest(BaseModel):
    query: str


class ProblemAnalysisRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    location: Optional[str] = None
    image_id: Optional[int] = Field(default=None, gt=0)


IMAGE_SIGNATURES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
}


@router.post("/problem-images", status_code=status.HTTP_201_CREATED)
async def upload_problem_image(
    upload: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.USER:
        raise HTTPException(status_code=403, detail="Only customers can upload problem images.")
    content = await upload.read(settings.PROBLEM_IMAGE_MAX_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(content) > settings.PROBLEM_IMAGE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Images must be 5 MB or smaller.")
    detected_type = next(
        (content_type for content_type, (_, matches) in IMAGE_SIGNATURES.items() if matches(content)),
        None,
    )
    if not detected_type or upload.content_type not in (detected_type, "application/octet-stream"):
        raise HTTPException(status_code=415, detail="Upload a valid JPG, PNG, or WebP image.")

    extension, _ = IMAGE_SIGNATURES[detected_type]
    storage_dir = (Path(settings.PRIVATE_UPLOAD_DIR).resolve() / "problem-images").resolve()
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"{uuid.uuid4().hex}{extension}"
    storage_path = storage_dir / storage_name
    if storage_path.parent != storage_dir:
        raise HTTPException(status_code=400, detail="Invalid upload path.")
    original_filename = Path((upload.filename or "problem-image").replace("\\", "/")).name[:255]
    image = ProblemImage(
        user_id=current_user.id,
        storage_name=storage_name,
        content_type=detected_type,
        original_filename=original_filename,
    )
    try:
        storage_path.write_bytes(content)
        db.add(image)
        db.commit()
        db.refresh(image)
    except OSError:
        db.rollback()
        storage_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="The uploaded image could not be stored.")
    except Exception:
        db.rollback()
        storage_path.unlink(missing_ok=True)
        raise
    return {
        "image_id": image.id,
        "content_type": image.content_type,
        "filename": image.original_filename,
    }


@router.get("/problem-images/{image_id}")
def get_problem_image(
    image_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    image = db.query(ProblemImage).filter(ProblemImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found.")
    authorized = image.user_id == current_user.id or current_user.role == UserRole.ADMIN
    if not authorized and current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        authorized = bool(provider and db.query(Booking.id).filter(
            Booking.problem_image_id == image.id,
            Booking.provider_id == provider.id,
        ).first())
    if not authorized:
        raise HTTPException(status_code=404, detail="Image not found.")
    storage_dir = (Path(settings.PRIVATE_UPLOAD_DIR).resolve() / "problem-images").resolve()
    storage_path = (storage_dir / image.storage_name).resolve()
    if storage_path.parent != storage_dir or not storage_path.is_file():
        raise HTTPException(status_code=404, detail="Image is not available.")
    return FileResponse(storage_path, media_type=image.content_type, filename=image.original_filename)


class RecommendRequest(BaseModel):
    query: Optional[str] = None
    service_id: Optional[int] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None
    urgency: Optional[str] = "normal"
    max_candidates: int = 6


@router.post("/analyze")
@router.post("/analyze/")
async def analyze_endpoint(
    request: ProblemAnalysisRequest,
    db: Session = Depends(get_db)
):
    """
    LLM Conversational Problem Understanding & Intent Extraction.
    Returns:
    {
      "response": "...",
      "intent": "service_required" | "guidance",
      "category": "...",
      "service": "...",
      "show_providers": boolean,
      "urgency": "...",
      "problem": "...",
      "diy_steps": [...]
    }
    """
    query_text = request.message or request.query or ""
    return await ProblemAnalyzer.analyze(query_text, request.location, db)


@router.post("/analyze-problem")
@router.post("/analyze-problem/")
async def analyze_problem_endpoint(
    request: ProblemAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    LLM Problem Understanding and Triage Engine:
    A. Provide useful guidance when the problem is simple (DIY).
    B. Identify when professional assistance is appropriate and connect to recommendation pipeline.
    """
    query_text = request.query or request.message or ""
    image_bytes = None
    image_mime = None
    if request.image_id is not None:
        if not current_user or current_user.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Sign in as a customer to use an uploaded image.")
        image = db.query(ProblemImage).filter(
            ProblemImage.id == request.image_id,
            ProblemImage.user_id == current_user.id,
        ).first()
        if not image:
            raise HTTPException(status_code=404, detail="Uploaded problem image not found.")
        storage_dir = (Path(settings.PRIVATE_UPLOAD_DIR).resolve() / "problem-images").resolve()
        storage_path = (storage_dir / image.storage_name).resolve()
        if storage_path.parent != storage_dir or not storage_path.is_file():
            raise HTTPException(status_code=404, detail="Uploaded problem image is not available.")
        image_bytes = storage_path.read_bytes()
        image_mime = image.content_type

    analysis = await ProblemAnalyzer.analyze(
        query_text,
        request.location,
        db,
        image_bytes=image_bytes,
        image_mime=image_mime,
    )
    analysis["image_attached"] = request.image_id is not None
    return analysis


@router.post("/service-understanding")
@router.post("/service-understanding/")
async def semantic_service_understanding(
    request: ServiceUnderstandingRequest,
    db: Session = Depends(get_db)
):
    """
    Semantic service understanding and problem classification using BGE-M3 + LLM.
    """
    analysis = await ProblemAnalyzer.analyze(request.query, db=db)
    analysis["confidence"] = 0.95
    return analysis


@router.post("/recommend")
@router.post("/recommend/")
def get_recommendations(
    request: RecommendRequest,
    db: Session = Depends(get_db)
):
    """
    Multi-objective personalized recommendation and provider matching.
    Orchestrated by Multi-Stage AI/ML Pipeline:
    - BGE-M3 (Semantic Service Understanding)
    - Location + Haversine (Proximity Filtering)
    - BERT4Rec (Sequential Candidate Generation)
    - HGT (Heterogeneous Graph Transformer Suitability)
    - Cross-Encoder (Deep Re-Ranking)
    - DeBERTa-v3 (Review Sentiment Analysis)
    """
    return RecommendationEngine.recommend(
        db=db,
        query=request.query,
        service_id=request.service_id,
        location=request.location,
        latitude=request.latitude,
        longitude=request.longitude,
        radius_km=request.radius_km,
        urgency=request.urgency or "normal",
        max_candidates=request.max_candidates
    )
