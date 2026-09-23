from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from app.data_loader import load_contractors
from app.models import RecommendationRequest
from app.recommender import recommend


CATALOGUE = load_contractors(Path(__file__).parents[1] / "data" / "contractors.csv")
BASE = next(item for item in CATALOGUE if item.id == "HK-37181")


def request(**changes):
    values = dict(city=BASE.city, category="Ведущий", event_type="свадьба", event_date=date(2026, 10, 15), budget_kzt=1_000_000)
    values.update(changes)
    return RecommendationRequest(**values)


def profile(id_, description, **changes):
    return replace(BASE, id=id_, description=description, price_from_kzt=500_000, busy_dates=frozenset(), **changes)


def test_evidence_score_rewards_facts_and_relevance_not_category_words():
    items = [profile("none", "Профессиональный ведущий для свадьбы."), profile("general", "Собственное производство леденцов без сахара."), profile("relevant", "Веду мероприятия более 15 лет.")]
    cards = {card.id: card for card in recommend(request(), items).results}
    assert cards["none"].score == 20  # 15 budget + 5 duration not requested
    assert cards["general"].score == 25  # + 5 substantive profile detail
    assert cards["relevant"].score == 35  # + 5 fact + 10 category relevance
    assert "profile" not in cards["none"].match_factors
    assert "relevant_profile" not in cards["general"].match_factors
    assert "relevant_profile" in cards["relevant"].match_factors


def test_budget_headroom_and_language_still_contribute_to_ranking():
    item = profile("one", "Опыт работы 15 лет.")
    ordinary = recommend(request(), [item]).results[0]
    larger_budget = recommend(request(budget_kzt=2_000_000), [item]).results[0]
    with_language = recommend(request(language="русский"), [item]).results[0]
    assert larger_budget.score - ordinary.score == pytest.approx(7.5)
    assert with_language.score - ordinary.score == 20


def test_equal_scores_sort_by_price_then_id_regardless_of_input_order():
    # Exact same facts and conditions => ID breaks the tie deterministically.
    items = [profile(id_, "Ведущий для вашего праздника.") for id_ in ["C", "A", "B", "D"]]
    expected = ["A", "B", "C"]
    for ordering in [items, list(reversed(items)), items[1:] + items[:1]]:
        result = recommend(request(), ordering)
        assert [card.id for card in result.results] == expected
        assert result.eligible_count == 4
        assert len(result.results) == 3


def test_source_fact_does_not_bypass_hard_filters():
    item = profile("one", "Веду мероприятия более 15 лет.")
    assert not recommend(request(budget_kzt=1), [item]).results
    assert not recommend(request(language="несуществующий"), [item]).results
    assert not recommend(request(duration_hours=99), [item]).results
    booked = replace(item, busy_dates=frozenset({"2026-10-15"}))
    assert recommend(request(), [booked]).excluded_summary == {"booked": 1}


def test_same_real_query_is_stable_and_date_change_excludes_busy_host():
    first = recommend(request(), CATALOGUE)
    repeated = recommend(request(), list(reversed(CATALOGUE)))
    next_day = recommend(request(event_date=date(2026, 10, 16)), CATALOGUE)
    assert first.model_dump() == repeated.model_dump()
    assert "HK-80581" in {card.id for card in first.results}
    assert "HK-80581" not in {card.id for card in next_day.results}
    assert next_day.excluded_summary["booked"] == first.excluded_summary["booked"] + 1
