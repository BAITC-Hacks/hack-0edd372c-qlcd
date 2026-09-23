from dataclasses import replace
from datetime import date
from pathlib import Path
import re

import pytest

from app.data_loader import load_contractors
from app.explanations import build_explanation
from app.models import RecommendationRequest
from app.recommender import recommend
from app.semantic import description_evidence, select_evidence, source_fragments


CONTRACTORS = load_contractors(Path(__file__).parents[1] / "data" / "contractors.csv")
BY_ID = {item.id: item for item in CONTRACTORS}


@pytest.mark.parametrize("query, expected_count", [
    (dict(city="Алматы", event_date=date(2026, 10, 11), event_type="свадьба", category="Флорист", budget_kzt=400_000, duration_hours=8, language="русский"), 2),
    (dict(city="Алматы", event_date=date(2026, 11, 14), event_type="свадьба", category="Банкетный зал", budget_kzt=6_500_000, duration_hours=6, language="русский"), 2),
    (dict(city="Астана", event_date=date(2026, 10, 15), event_type="свадьба", category="Ведущий", budget_kzt=1_000_000), 3),
])
def test_demo_explanations_have_distinct_facts_without_names_or_prices(query, expected_count):
    cards = recommend(RecommendationRequest(**query), CONTRACTORS).results
    assert len(cards) == expected_count
    facts = []
    for card in cards:
        item = BY_ID[card.id]
        evidence = select_evidence(item.description, query["category"], query["event_type"])
        assert evidence is not None
        assert evidence.text in card.explanation
        assert "relevant_profile" in card.match_factors
        # Compare only substantive facts, excluding ALL catalogue conditions.
        facts.append(evidence.text.replace(item.name, "[name]"))
    assert len(set(facts)) == len(facts)


def test_live_band_duplicate_regression_uses_distinct_lineups():
    ids = ["HK-23752", "HK-31819", "HK-83709"]
    facts = [description_evidence(BY_ID[id_].description, "Лайв-бэнд", "свадьба") for id_ in ids]
    assert all(facts)
    assert "два вокалиста" in facts[0]
    assert "звукорежиссёр" in facts[1]
    assert "клавишник" in facts[2]
    for index, name in enumerate(["Thunder Breath Band", "Rurouni Sound", "Eva Sound"]):
        facts[index] = facts[index].replace(name, "[name]")
    assert len(set(facts)) == 3


def test_nami_quotes_experience_not_greeting_or_slogan():
    evidence = description_evidence(BY_ID["HK-37181"].description, "Ведущий", "свадьба")
    assert evidence == "ВЕДУ МЕРОПРИЯТИЯ УЖЕ БОЛЕЕ 15 ЛЕТ."


def test_every_catalogue_fact_is_a_complete_verbatim_source_fragment():
    found = 0
    for item in CONTRACTORS:
        for category in item.categories:
            for event_type in item.event_formats:
                evidence = select_evidence(item.description, category, event_type)
                if evidence is None:
                    continue
                found += 1
                assert evidence.text in source_fragments(item.description)
                assert evidence.text in re.sub(r"\s+", " ", item.description)
                assert evidence == select_evidence(item.description, category, event_type)
    assert found > 100


def test_long_evidence_is_not_cut_at_180_characters():
    evidence = description_evidence(BY_ID["HK-58385"].description, "Ведущий", "корпоратив")
    assert len(evidence) > 180
    assert evidence.endswith("SakuraLab.")
    assert evidence in BY_ID["HK-58385"].description


def test_greetings_and_marketing_without_facts_do_not_earn_evidence():
    description = "Привет! Профессиональный ведущий для свадьбы. Ваш праздник — в руках ведущего, который делает уровень."
    item = replace(BY_ID["HK-37181"], description=description)
    explanation, factors = build_explanation(item, category="Ведущий", event_type="свадьба", budget_kzt=1_000_000, duration_hours=None, language=None)
    assert "profile" not in factors
    assert "relevant_profile" not in factors
    assert "недостаточно конкретных сведений" in explanation


def test_source_language_price_and_hour_claims_cannot_override_catalogue():
    description = "Работаю только на английском языке, с импровизацией. В стоимость 100 тенге входит скрипка. Работаю 24 часа с саксофоном. Опыт ведения мероприятий 12 лет."
    evidence = description_evidence(description, "Ведущий", "свадьба")
    assert evidence == "Опыт ведения мероприятий 12 лет."


def test_requested_secondary_category_controls_evidence_selection():
    item = replace(BY_ID["HK-64395"], categories=("Банкетный зал", "Фото и видеобудки"), description="Панорамные окна и парковка для 200 гостей. Зеркальная фотобудка с сенсорным экраном и печатью фото.")
    common = dict(event_type="свадьба", budget_kzt=9_000_000, duration_hours=None, language=None)
    venue_text, _ = build_explanation(item, category="Банкетный зал", **common)
    booth_text, factors = build_explanation(item, category="Фото и видеобудки", **common)
    assert "Панорамные окна" in venue_text
    assert "Зеркальная фотобудка" in booth_text
    assert "Панорамные окна" not in booth_text
    assert "relevant_profile" in factors


def test_null_duration_does_not_promise_unlimited_work():
    item = BY_ID["HK-90001"]
    explanation, factors = build_explanation(item, category="Флорист", event_type="свадьба", budget_kzt=500_000, duration_hours=8, language=None)
    assert "ограничение длительности в каталоге не задано" in explanation
    assert "duration" not in factors


def test_sentence_splitter_preserves_abbreviated_city_references():
    source = "Резидент школы Ведущих в г.Челябинск, г.Москва. Опыт работы 12 лет."
    assert source_fragments(source) == ["Резидент школы Ведущих в г.Челябинск, г.Москва.", "Опыт работы 12 лет."]
