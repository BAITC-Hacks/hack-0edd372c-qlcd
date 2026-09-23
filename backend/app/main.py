from __future__ import annotations

import hashlib
import os
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .data_loader import load_contractors, unique_values
from .models import CatalogMeta, RecommendationRequest, RecommendationResponse
from .recommender import recommend

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "contractors.csv"
DATASET_VERSION = hashlib.sha256(DATA_PATH.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:12]
CONTRACTORS = load_contractors(DATA_PATH)
API_VERSION = "1.2.0"
_DEFAULT_ORIGINS = tuple(
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (3000, 5173, 4173)
)


def cors_origins() -> list[str]:
    """Explicit origins only; custom deployments can override the local defaults."""
    configured = os.getenv("CORS_ORIGINS")
    values = _DEFAULT_ORIGINS if configured is None else configured.split(",")
    origins: list[str] = []
    for value in values:
        origin = value.strip().rstrip("/")
        if not origin:
            continue
        try:
            parsed = urlsplit(origin)
            valid_port = parsed.port is None or 1 <= parsed.port <= 65535
        except ValueError as error:
            raise ValueError("CORS_ORIGINS must contain HTTP(S) origins") from error
        if (
            parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username or parsed.password or parsed.path
            or parsed.query or parsed.fragment or not valid_port
            or "*" in parsed.netloc or any(char.isspace() for char in origin)
        ):
            raise ValueError("CORS_ORIGINS must contain HTTP(S) origins without credentials or paths")
        if origin not in origins:
            origins.append(origin)
    return origins


def create_app() -> FastAPI:
    application = FastAPI(title="HackAlem Smart Contractor Matcher", version=API_VERSION)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @application.exception_handler(RequestValidationError)
    async def request_validation_error(_request, error: RequestValidationError):
        # Raw inputs/ctx can contain NaN, Infinity or exceptions that are not JSON
        # serializable. Expose field locations and validation messages, not inputs.
        detail = [
            {"type": item["type"], "loc": list(item["loc"]), "msg": item["msg"]}
            for item in error.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": detail})

    @application.get("/health")
    def health() -> dict[str, object]:
        return {
            "status": "ok", "profiles_loaded": len(CONTRACTORS),
            "dataset_version": DATASET_VERSION, "api_version": API_VERSION,
        }

    @application.get("/api/meta", response_model=CatalogMeta)
    def meta() -> CatalogMeta:
        return CatalogMeta(
            profile_count=len(CONTRACTORS), cities=unique_values(CONTRACTORS, "city"),
            categories=unique_values(CONTRACTORS, "categories"),
            event_formats=unique_values(CONTRACTORS, "event_formats"),
            languages=unique_values(CONTRACTORS, "languages"), dataset_version=DATASET_VERSION,
        )

    @application.post("/api/recommend", response_model=RecommendationResponse)
    def recommendations(request: RecommendationRequest) -> RecommendationResponse:
        return recommend(request, CONTRACTORS, DATASET_VERSION)

    return application


app = create_app()
