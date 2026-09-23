# Smart Contractor Matcher — backend

Explainable, availability-aware matching API for the HackAlem contractor catalog.

## What it does

The service searches only the supplied 66-profile CSV catalog. It applies hard constraints in this order: city/category, booked date, budget, event format, language, and duration. It then ranks eligible profiles using a deterministic transparent score based on budget headroom, requested language/duration fit, and evidence in the profile description. The same request always produces the same order.

The API never books a contractor or invents a new profile. It returns up to three cards plus an explanation and aggregate exclusion reasons.

## Run

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend endpoint: `POST http://localhost:8000/api/recommend`. Metadata is available at `GET /api/meta`; health is `GET /health`.

## Request example

```json
{"city":"Алматы","event_date":"2026-10-12","event_type":"свадьба","category":"Флорист","budget_kzt":500000,"duration_hours":6,"language":"русский"}
```

## Response guarantees

- statuses: `matches_found`, `no_category_in_city`, `no_candidates_meet_conditions`;
- maximum three results;
- stable ordering using score, price, and profile ID;
- `dataset_version` identifies the loaded CSV;
- cards expose `synthetic`, `city_imputed`, and `price_imputed` provenance flags;
- explanations use actual availability, budget, format, language, duration, and profile evidence.

## Tests

```powershell
py -3.13 -m pytest -q
```