from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.problem_analyzer import ProblemAnalyzer
from app.ml.recommendation_engine import RecommendationEngine

router = APIRouter()


class ServiceUnderstandingRequest(BaseModel):
    query: str


class ProblemAnalysisRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    location: Optional[str] = None


class RecommendRequest(BaseModel):
    query: Optional[str] = None
    service_id: Optional[int] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
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
    db: Session = Depends(get_db)
):
    """
    LLM Problem Understanding and Triage Engine:
    A. Provide useful guidance when the problem is simple (DIY).
    B. Identify when professional assistance is appropriate and connect to recommendation pipeline.
    """
    query_text = request.query or request.message or ""
    return await ProblemAnalyzer.analyze(query_text, request.location, db)


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
        urgency=request.urgency or "normal",
        max_candidates=request.max_candidates
    )
