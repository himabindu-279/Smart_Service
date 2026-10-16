"""
AI/ML Recommendation & Matching Pipeline for Smart Service Marketplace.
Modules:
- BGE-M3: Semantic Service Understanding & Intent Extraction
- Spatial Filter: Haversine distance & geographic filtering
- BERT4Rec: Sequential Personalized Candidate Generation
- HGT: Heterogeneous Graph Transformer for Provider Suitability
- Cross-Encoder: Deep Semantic Provider Re-Ranking
- DeBERTa-v3: Review Sentiment Analysis
- RecommendationEngine: Multi-objective orchestrator
"""

from app.ml.bge_m3_matcher import BGEM3Matcher
from app.ml.bert4rec_model import BERT4RecModel
from app.ml.hgt_matcher import HGTMatcher
from app.ml.cross_encoder_ranker import CrossEncoderRanker
from app.ml.deberta_sentiment import DeBERTaSentimentAnalyzer
from app.ml.recommendation_engine import RecommendationEngine

__all__ = [
    "BGEM3Matcher",
    "BERT4RecModel",
    "HGTMatcher",
    "CrossEncoderRanker",
    "DeBERTaSentimentAnalyzer",
    "RecommendationEngine"
]
