from datetime import date
from pathlib import Path

import pytest

from app.data_loader import load_contractors, unique_values
from app.models import RecommendationRequest
from app.recommender import recommend

CONTRACTORS = load_contractors(Path(__file__).parents[1] / "data" / "contractors.csv")


def request(**overrides):
    values = dict(city="Алматы", event_date=date(2026, 10, 11), event_type="свадьба", category="Флорист", budget_kzt=500_000)
    values.update(overrides)
    return RecommendationRequest(**values)


def test_loads_all_profiles():
    assert len(CONTRACTORS) == 66


def test_metadata_keeps_city_names_intact():
    assert unique_values(CONTRACTORS, "city") == ["Алматы", "Астана", "Зарубежье"]


def test_deterministic_order():
    first = recommend(request(), CONTRACTORS)
    assert len(first.results) == 2
    assert first.model_dump() == recommend(request(), CONTRACTORS).model_dump()
    assert first.model_dump() == recommend(request(), list(reversed(CONTRACTORS))).model_dump()


def test_busy_profile_is_not_returned():
    available = recommend(request(), CONTRACTORS)
    assert {card.id for card in available.results} == {"HK-39372", "HK-90001"}
    response = recommend(request(event_date=date(2026, 9, 25)), CONTRACTORS)
    assert response.results == []
    assert response.total_category_city == 2
    assert response.excluded_summary == {"booked": 2}


def test_provenance_flags_are_returned():
    response = recommend(request(), CONTRACTORS, dataset_version="test-version")
    assert len(response.results) == 2
    assert response.dataset_version == "test-version"
    assert all(isinstance(card.city_imputed, bool) and isinstance(card.price_imputed, bool) for card in response.results)


def test_distinguishes_missing_category_and_constraints():
    assert recommend(request(category="Несуществующая категория"), CONTRACTORS).status == "no_category_in_city"
    constrained = recommend(request(budget_kzt=1), CONTRACTORS)
    assert constrained.status == "no_candidates_meet_conditions"
    assert constrained.excluded_summary


@pytest.mark.parametrize("overrides,reason", [
    ({"event_date": date(2026, 9, 25)}, "booked"),
    ({"budget_kzt": 1}, "over_budget"),
    ({"event_type": "несуществующий формат"}, "format"),
    ({"language": "несуществующий язык"}, "language"),
])
def test_each_constraint_rejects_previously_eligible_profiles(overrides, reason):
    assert recommend(request(), CONTRACTORS).eligible_count == 2
    result = recommend(request(**overrides), CONTRACTORS)
    assert result.results == []
    assert result.excluded_summary == {reason: 2}


def test_duration_filters_present_limits_without_treating_null_as_zero():
    florist = recommend(request(duration_hours=24), CONTRACTORS)
    assert {card.id for card in florist.results} == {"HK-39372", "HK-90001"}
    venue_request = request(category="Банкетный зал", event_date=date(2026, 11, 14),
                            budget_kzt=6500000, duration_hours=6)
    venues = recommend(venue_request, CONTRACTORS)
    assert venues.eligible_count == 2
    long_event = recommend(venue_request.model_copy(update={"duration_hours": 1000}), CONTRACTORS)
    assert long_event.results == []
    assert long_event.excluded_summary == {"booked": 5, "duration": 2}
