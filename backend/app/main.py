from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .data_loader import load_contractors, unique_values
from .models import CatalogMeta, RecommendationRequest, RecommendationResponse
from .recommender import recommend

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "contractors.csv"
DATASET_VERSION = hashlib.sha256(DATA_PATH.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:12]
CONTRACTORS = load_contractors(DATA_PATH)
app = FastAPI(title="HackAlem Smart Contractor Matcher", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "profiles_loaded": len(CONTRACTORS), "dataset_version": DATASET_VERSION}


@app.get("/api/meta", response_model=CatalogMeta)
def meta() -> CatalogMeta:
    return CatalogMeta(profile_count=len(CONTRACTORS), cities=unique_values(CONTRACTORS, "city"), categories=unique_values(CONTRACTORS, "categories"), event_formats=unique_values(CONTRACTORS, "event_formats"), languages=unique_values(CONTRACTORS, "languages"), dataset_version=DATASET_VERSION)


@app.post("/api/recommend", response_model=RecommendationResponse)
def recommendations(request: RecommendationRequest) -> RecommendationResponse:
    if not ("2026-09-23" <= request.event_date.isoformat() <= "2026-12-31"):
        raise HTTPException(status_code=422, detail="event_date must be between 2026-09-23 and 2026-12-31")
    return recommend(request, CONTRACTORS, DATASET_VERSION)