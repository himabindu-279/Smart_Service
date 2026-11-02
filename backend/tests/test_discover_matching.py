import asyncio

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.models.category import Category
from app.models.service import Service
from app.ml.recommendation_engine import RecommendationEngine
from app.services.problem_analyzer import ProblemAnalyzer


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        category = Category(name="Home Services", slug="home-services")
        session.add(category)
        session.flush()
        services = [
            ("Plumbing", "plumbing"),
            ("AC Repair", "ac-repair"),
            ("Electrical", "electrical"),
            ("Cleaning", "cleaning"),
            ("Refrigerator Repair", "refrigerator-repair"),
            ("Washing Machine Repair", "washing-machine-repair"),
            ("Microwave Repair", "microwave-repair"),
            ("Dishwasher Repair", "dishwasher-repair"),
        ]
        session.add_all(
            Service(
                category_id=category.id,
                name=name,
                slug=slug,
                base_price=100,
                is_active=True,
            )
            for name, slug in services
        )
        session.commit()
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.mark.parametrize(
    ("query", "expected_slug"),
    [
        ("My fridge is not cooling", "refrigerator-repair"),
        ("my fridge is not cooling", "refrigerator-repair"),
        ("washing machine stopped draining", "washing-machine-repair"),
        ("microwave is not heating", "microwave-repair"),
        ("dishwasher won't drain", "dishwasher-repair"),
        ("నా ఇంటి పైపు లీక్ అవుతోంది", "plumbing"),
        ("मेरे घर का नल लीक हो रहा है", "plumbing"),
        ("I need my house cleaned", "cleaning"),
        ("I need a plumber", "plumbing"),
        ("My ceiling fan is not working", "electrical"),
    ],
)
def test_problem_maps_to_matching_catalog_service(db, monkeypatch, query, expected_slug):
    monkeypatch.setattr(settings, "LLM_API_KEY", "")

    result = asyncio.run(ProblemAnalyzer.analyze(query, db=db))

    assert result["service_id"] is not None
    assert result["service"] == next(
        service.name for service in db.query(Service).all()
        if service.slug == expected_slug
    )
    assert result["decision"] == "PROFESSIONAL_SERVICE"
    if expected_slug == "electrical":
        assert result["matched_subservice"] == "Fan Repair"


def test_guidance_keeps_service_id_for_customer_escalation(db, monkeypatch):
    monkeypatch.setattr(settings, "LLM_API_KEY", "")

    result = asyncio.run(ProblemAnalyzer.analyze("My AC remote is not working", db=db))

    assert result["decision"] == "SIMPLE_GUIDANCE"
    assert result["service_id"] is not None
    assert result["service"] == "AC Repair"


def test_appliance_repair_result_always_searches_for_providers(db, monkeypatch):
    monkeypatch.setattr(settings, "LLM_API_KEY", "")
    monkeypatch.setattr(
        ProblemAnalyzer,
        "_expert_heuristic_reasoning",
        classmethod(lambda cls, _query, original: {
            "decision": "SIMPLE_GUIDANCE",
            "classification": "SIMPLE_PROBLEM",
            "needs_professional": False,
            "show_providers": False,
            "intent": "guidance",
            "problem": original,
            "service": "Dishwasher Repair",
        }),
    )

    result = asyncio.run(ProblemAnalyzer.analyze("dishwasher won't drain", db=db))

    assert result["decision"] == "PROFESSIONAL_SERVICE"
    assert result["show_providers"] is True
    assert result["service"] == "Dishwasher Repair"
    assert result["service_id"] is not None


def test_unrecognized_problem_does_not_default_to_ac_repair(db, monkeypatch):
    monkeypatch.setattr(settings, "LLM_API_KEY", "")

    result = asyncio.run(ProblemAnalyzer.analyze("something is wrong at my home", db=db))

    assert result["decision"] == "NO_MATCH"
    assert result["service_id"] is None
    assert result["service"] is None


def test_llm_no_match_is_not_presented_as_diy_guidance():
    result = ProblemAnalyzer._format_response(
        {
            "intent": "no_match",
            "show_providers": False,
            "service": None,
        },
        "unrecognized problem",
    )

    assert result["decision"] == "NO_MATCH"
    assert result["service"] is None
    assert result["follow_up_prompt"] == ""


def test_matched_service_explains_when_no_approved_provider_offers_it(db):
    service = db.query(Service).filter_by(slug="washing-machine-repair").one()

    result = RecommendationEngine.recommend(
        db,
        query="washing machine stopped draining",
        service_id=service.id,
    )

    assert result["detected_service"] == "Washing Machine Repair"
    assert result["recommendations"] == []
    assert result["provider_service_available"] is False
    assert "No approved and available providers" in result["message"]
