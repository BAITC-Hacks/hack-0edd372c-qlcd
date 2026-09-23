from datetime import date, datetime

import pytest
from pydantic import ValidationError

from app.models import CALENDAR_END, CALENDAR_START, MAX_SAFE_INTEGER, RecommendationRequest


def request(**overrides):
    values = dict(
        city="Алматы", event_date="2026-10-10", event_type="корпоратив",
        category="Ведущий", budget_kzt=1_500_000,
    )
    values.update(overrides)
    return RecommendationRequest(**values)


def test_trims_text_before_validation_and_normalizes_unspecified_language():
    query = request(city="  Алматы ", event_type=" корпоратив\t", category=" Ведущий ", language=" \t ")
    assert query.city == "Алматы"
    assert query.event_type == "корпоратив"
    assert query.category == "Ведущий"
    assert query.language is None
    assert request(language=" русский ").language == "русский"


@pytest.mark.parametrize("field", ["city", "event_type", "category"])
@pytest.mark.parametrize("value", ["", " ", "\t\r\n", "\u2003"])
def test_rejects_empty_required_fields_after_trimming(field, value):
    with pytest.raises(ValidationError) as caught:
        request(**{field: value})
    assert caught.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize("field", ["budget_kzt", "limit"])
@pytest.mark.parametrize("value", [True, False, 1.0, 1.5, "1", float("inf"), float("nan")])
def test_budget_and_limit_require_actual_whole_json_integers(field, value):
    with pytest.raises(ValidationError) as caught:
        request(**{field: value})
    assert caught.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize(("field", "value"), [
    ("budget_kzt", 0), ("budget_kzt", -1), ("budget_kzt", MAX_SAFE_INTEGER + 1),
    ("budget_kzt", 10**1000), ("limit", 0), ("limit", 4),
])
def test_integer_boundaries(field, value):
    with pytest.raises(ValidationError) as caught:
        request(**{field: value})
    assert caught.value.errors()[0]["loc"] == (field,)
    assert request(budget_kzt=MAX_SAFE_INTEGER, limit=1).budget_kzt == MAX_SAFE_INTEGER


@pytest.mark.parametrize("value", [
    True, False, 0, -1, "6", "Infinity", "NaN", float("inf"), float("-inf"), float("nan"),
])
def test_duration_rejects_non_numeric_boolean_non_finite_and_non_positive_values(value):
    with pytest.raises(ValidationError) as caught:
        request(duration_hours=value)
    assert caught.value.errors()[0]["loc"] == ("duration_hours",)


@pytest.mark.parametrize("hours", [None, 6, 6.5])
def test_duration_accepts_optional_finite_integer_or_fraction(hours):
    assert request(duration_hours=hours).duration_hours == hours


@pytest.mark.parametrize("value", [
    "2026-09-22", "2027-01-01", "2026-09-31", "20260923", "2026-9-23",
    "2026-10-10T00:00:00", datetime(2026, 10, 10), 1791590400, True, None,
])
def test_calendar_date_rejects_outside_coverage_invalid_dates_and_timestamp_coercion(value):
    with pytest.raises(ValidationError) as caught:
        request(event_date=value)
    assert caught.value.errors()[0]["loc"] == ("event_date",)


@pytest.mark.parametrize("value", [CALENDAR_START, CALENDAR_END, "2026-09-23", "2026-12-31", date(2026, 10, 10)])
def test_calendar_bounds_are_inclusive(value):
    assert CALENDAR_START <= request(event_date=value).event_date <= CALENDAR_END
