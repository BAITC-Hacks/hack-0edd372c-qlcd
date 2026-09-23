from datetime import date
from pathlib import Path

from app.data_loader import load_contractors
from app.models import RecommendationRequest
from app.recommender import recommend

CONTRACTORS = load_contractors(Path(__file__).parents[1] / "data" / "contractors.csv")


def request(**overrides):
    values = dict(city="Алматы", event_date=date(2026, 10, 12), event_type="свадьба", category="Флорист", budget_kzt=500_000)
    values.update(overrides)
    return RecommendationRequest(**values)


def test_loads_all_profiles():
    assert len(CONTRACTORS) == 66


def test_deterministic_order():
    assert [x.id for x in recommend(request(), CONTRACTORS).results] == [x.id for x in recommend(request(), CONTRACTORS).results]


def test_busy_profile_is_not_returned():
    response = recommend(request(event_date=date(2026, 9, 25)), CONTRACTORS)
    assert all("2026-09-25" not in next(c for c in CONTRACTORS if c.id == card.id).busy_dates for card in response.results)


def test_distinguishes_missing_category_and_constraints():
    assert recommend(request(category="Несуществующая категория"), CONTRACTORS).status == "no_category_in_city"
    constrained = recommend(request(budget_kzt=1), CONTRACTORS)
    assert constrained.status == "no_candidates_meet_conditions"
    assert constrained.excluded_summary
