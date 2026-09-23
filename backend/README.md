# Smart Contractor Matcher — backend

Backend for the HackAlem task. It searches only the supplied 66-profile catalog, removes profiles booked on the requested date, applies hard constraints, then ranks the remaining profiles with a deterministic transparent score.

## Run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend endpoint: `POST http://localhost:8000/api/recommend`. Metadata is available at `GET /api/meta`; health is `GET /health`.

## Request example

```json
{"city":"Алматы","event_date":"2026-10-12","event_type":"свадьба","category":"Флорист","budget_kzt":500000,"duration_hours":6,"language":"русский"}
```

Statuses are `matches_found`, `no_category_in_city`, and `no_candidates_meet_conditions`. Each card contains actual match factors and profile-specific description evidence. Stable score ties use price and profile ID, so repeated requests keep the same order.

## Tests

```bash
pytest -q
```
