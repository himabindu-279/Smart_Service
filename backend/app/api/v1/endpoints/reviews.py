from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.booking import Booking
from app.models.review import Review
from app.models.rating import Rating
from app.models.provider import Provider
from app.models.user import User
from app.models.enums import BookingStatus
from app.api.deps import get_current_active_user
from app.ml.deberta_sentiment import DeBERTaSentimentAnalyzer

router = APIRouter()


class ReviewSubmission(BaseModel):
    booking_id: int
    score: Optional[float] = Field(None, ge=1.0, le=5.0)
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    review_text: str = Field(..., min_length=3)
    aspect_punctuality: float = 5.0
    aspect_quality: float = 5.0
    aspect_cost: float = 5.0


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def submit_review(
    review_in: ReviewSubmission,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Submit a review and rating for a completed booking."""
    booking = db.query(Booking).filter(Booking.id == review_in.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only review your own bookings.")

    # Check if already reviewed
    existing_review = db.query(Review).filter(Review.booking_id == booking.id).first()
    if existing_review:
        raise HTTPException(status_code=400, detail="This booking has already been reviewed.")

    score_val = review_in.score if review_in.score is not None else (review_in.rating if review_in.rating is not None else 5.0)

    # DeBERTa-v3 sentiment evaluation
    sentiment_data = DeBERTaSentimentAnalyzer.analyze(review_in.review_text)
    sentiment_label = sentiment_data.get("sentiment", "POSITIVE" if score_val >= 3.5 else "NEGATIVE")
    sentiment_conf = sentiment_data.get("confidence", 0.95)

    # Create review record
    review = Review(
        booking_id=booking.id,
        user_id=current_user.id,
        provider_id=booking.provider_id,
        service_id=booking.service_id,
        review_text=review_in.review_text,
        sentiment=sentiment_label,
        sentiment_score=sentiment_conf
    )
    db.add(review)

    # Create rating record
    rating = Rating(
        booking_id=booking.id,
        user_id=current_user.id,
        provider_id=booking.provider_id,
        score=score_val,
        aspect_punctuality=review_in.aspect_punctuality,
        aspect_quality=review_in.aspect_quality,
        aspect_cost=review_in.aspect_cost
    )
    db.add(rating)

    # Re-calculate provider average rating
    provider = db.query(Provider).filter(Provider.id == booking.provider_id).first()
    if provider:
        all_ratings = db.query(Rating.score).filter(Rating.provider_id == provider.id).all()
        scores = [r[0] for r in all_ratings] + [score_val]
        provider.rating_avg = round(sum(scores) / len(scores), 1)
        provider.total_ratings = len(scores)

    db.commit()

    return {
        "message": "Review and rating submitted successfully!",
        "sentiment": sentiment_label,
        "sentiment_score": sentiment_conf,
        "score": score_val
    }


@router.get("/provider/{provider_id}")
def get_provider_reviews(provider_id: int, db: Session = Depends(get_db)):
    """Get all reviews for a provider."""
    reviews = (
        db.query(Review)
        .filter(Review.provider_id == provider_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "user_name": r.user.full_name if r.user else "Customer",
            "review_text": r.review_text,
            "sentiment": r.sentiment,
            "created_at": r.created_at.isoformat()
        }
        for r in reviews
    ]
