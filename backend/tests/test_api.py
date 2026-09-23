import json

import pytest
from fastapi.testclient import TestClient

from app.main import API_VERSION, DATASET_VERSION, create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    with TestClient(create_app()) as test_client:
        yield test_client


def query(**overrides):
    return {
        "city": "Алматы", "event_date": "2026-10-11", "event_type": "свадьба",
        "category": "Флорист", "budget_kzt": 400000, "duration_hours": None,
        "language": None, "limit": 3, **overrides,
    }


def test_catalog_metadata_and_live_contract(client):
    health = client.get("/health").json()
    assert health == {"status": "ok", "profiles_loaded": 66,
                      "dataset_version": DATASET_VERSION, "api_version": API_VERSION}
    meta = client.get("/api/meta").json()
    assert meta["cities"] == ["Алматы", "Астана", "Зарубежье"]
    assert meta["dataset_version"] == DATASET_VERSION
    assert client.get("/openapi.json").json()["info"]["version"] == API_VERSION
    response = client.post("/api/recommend", json=query())
    assert response.status_code == 200
    raw = response.json()
    assert raw["status"] == "matches_found"
    assert {card["id"] for card in raw["results"]} == {"HK-39372", "HK-90001"}
    assert raw["dataset_version"] == DATASET_VERSION
    assert raw["eligible_count"] == 2
    for card in raw["results"]:
        assert card["explanation"].strip()
        for key in ("synthetic", "city_imputed", "price_imputed"):
            assert isinstance(card[key], bool)
    assert client.post("/api/recommend", json=query()).json() == raw


@pytest.mark.parametrize("field,value", [
    ("city", "   "), ("event_type", "\t"), ("category", "\n"),
    ("budget_kzt", 0), ("budget_kzt", -1), ("budget_kzt", 1.5),
    ("budget_kzt", True), ("budget_kzt", 2 ** 53),
    ("duration_hours", "Infinity"), ("duration_hours", "NaN"),
    ("duration_hours", 0), ("duration_hours", -1), ("duration_hours", True),
    ("event_date", "2026-09-22"), ("event_date", "2027-01-01"),
    ("event_date", "2026-02-30"), ("event_date", 0),
    ("limit", 4), ("limit", 0), ("limit", True),
])
def test_invalid_parameters_are_field_errors_not_server_failures(client, field, value):
    response = client.post("/api/recommend", json=query(**{field: value}))
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any(error["loc"][-1] == field for error in detail)
    assert all("input" not in error and "ctx" not in error for error in detail)


@pytest.mark.parametrize("value", [float("inf"), float("-inf"), float("nan")])
def test_nonstandard_json_numbers_cannot_break_error_serialization(client, value):
    # Some JSON decoders accept these nonstandard constants. Even then the API
    # must reject them without trying to echo NaN/Infinity in its JSON response.
    response = client.post("/api/recommend", content=json.dumps(query(duration_hours=value)),
                           headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["detail"]
    assert "Infinity" not in response.text and "NaN" not in response.text


@pytest.mark.parametrize("event_date", ["2026-09-23", "2026-12-31"])
def test_both_calendar_boundaries_are_accepted(client, event_date):
    response = client.post("/api/recommend", json=query(event_date=event_date))
    assert response.status_code == 200
    assert response.json()["query"]["event_date"] == event_date


def test_text_is_normalized_before_validation_and_empty_optional_language_is_null(client):
    response = client.post("/api/recommend", json=query(city="  Алматы  ", language="  "))
    assert response.status_code == 200
    assert response.json()["query"]["city"] == "Алматы"
    assert response.json()["query"]["language"] is None
    assert response.json()["eligible_count"] == 2


def test_empty_results_keep_distinct_business_meanings(client):
    missing = client.post("/api/recommend", json=query(city="Астана", category="Инструменталист"))
    constrained = client.post("/api/recommend", json=query(budget_kzt=1))
    assert missing.status_code == constrained.status_code == 200
    assert missing.json()["status"] == "no_category_in_city"
    assert missing.json()["total_category_city"] == 0
    assert constrained.json()["status"] == "no_candidates_meet_conditions"
    assert constrained.json()["total_category_city"] == 2
    assert constrained.json()["excluded_summary"] == {"over_budget": 2}


def test_date_change_exposes_real_availability_and_venue_uses_same_calendar(client):
    request = query(city="Астана", category="Ведущий", budget_kzt=1000000, event_date="2026-10-15")
    before = client.post("/api/recommend", json=request).json()
    after = client.post("/api/recommend", json={**request, "event_date": "2026-10-16"}).json()
    assert {c["id"] for c in before["results"]} == {"HK-37181", "HK-80581", "HK-97041"}
    assert {c["id"] for c in after["results"]} == {"HK-37181", "HK-97041"}
    assert before["excluded_summary"] == {"booked": 2}
    assert after["excluded_summary"] == {"booked": 3}
    venue = client.post("/api/recommend", json=query(category="Банкетный зал", budget_kzt=6500000,
                         event_date="2026-11-14", duration_hours=6, language="русский")).json()
    assert {c["id"] for c in venue["results"]} == {"HK-64395", "HK-90011"}
    assert venue["excluded_summary"] == {"booked": 5}


def preflight(client, origin):
    return client.options("/api/recommend", headers={"Origin": origin,
                          "Access-Control-Request-Method": "POST",
                          "Access-Control-Request-Headers": "content-type"})


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:4173"])
def test_local_browser_origins_are_supported(client, origin):
    response = preflight(client, origin)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_custom_cors_uses_explicit_origins(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://events.example, http://localhost:5174")
    with TestClient(create_app()) as client:
        assert preflight(client, "https://events.example").status_code == 200
        assert preflight(client, "http://localhost:5174").status_code == 200
        rejected = preflight(client, "https://untrusted.example")
        assert rejected.status_code == 400
        assert "access-control-allow-origin" not in rejected.headers


@pytest.mark.parametrize("origin", [
    "*", "https://example.com/path", "https://user:secret@example.com", "javascript:alert(1)",
    "http://*", "https://*.example.com", "https://example.com bad",
])
def test_invalid_cors_configuration_fails_at_startup(monkeypatch, origin):
    monkeypatch.setenv("CORS_ORIGINS", origin)
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        create_app()
