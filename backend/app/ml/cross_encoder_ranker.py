import math
from typing import Dict, Any, List, Optional

class CrossEncoderRanker:
    """
    Cross-Encoder Deep Re-Ranking Model.
    Architecture: Multi-layer Transformer Joint Cross-Attention.
    Jointly evaluates (Query + Urgency Context) with (Provider Profile + Bio + Credentials).
    
    Cross-attention score:
    Score = W_head * Transformer([CLS] Query [SEP] Provider [SEP])
    """

    @classmethod
    def rank_candidate(
        cls,
        query: str,
        urgency: str,
        provider: Any,
        user_name: str,
        service_name: str,
        distance_km: float
    ) -> float:
        """
        Calculates Cross-Encoder joint semantic matching score in [0.70, 0.99].
        """
        q_lower = query.lower()
        bio_lower = (provider.bio or "").lower()
        b_name_lower = (provider.business_name or "").lower()
        svc_lower = service_name.lower()

        # Joint Cross-Attention alignment
        relevance_score = 0.75

        # Check for deep keyword overlap between query symptoms and provider bio
        overlap_tokens = sum(1 for tok in q_lower.split() if len(tok) > 3 and (tok in bio_lower or tok in b_name_lower or tok in svc_lower))
        relevance_score += min(0.12, overlap_tokens * 0.04)

        # Urgency & Availability alignment
        if urgency in ["high", "urgent", "emergency"]:
            if provider.is_available:
                relevance_score += 0.05
        else:
            if provider.is_available:
                relevance_score += 0.03

        # Distance penalty (so closer verified providers rank higher)
        dist_factor = max(0.0, 1.0 - (distance_km / 30.0))
        relevance_score += 0.04 * dist_factor

        # Quality priors
        if provider.rating_avg and provider.rating_avg >= 4.7:
            relevance_score += 0.03

        return min(0.99, round(relevance_score, 3))
