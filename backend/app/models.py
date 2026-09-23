from __future__ import annotations

import re
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .data_loader import CALENDAR_END, CALENDAR_START, MAX_SAFE_INTEGER


class RecommendationRequest(BaseModel):
    city: str = Field(min_length=1)
    event_date: date = Field(ge=CALENDAR_START, le=CALENDAR_END)
    event_type: str = Field(min_length=1)
    category: str = Field(min_length=1)
    budget_kzt: int = Field(gt=0, le=MAX_SAFE_INTEGER, strict=True)
    duration_hours: Optional[float] = Field(default=None, gt=0, allow_inf_nan=False, strict=True)
    language: Optional[str] = None
    limit: int = Field(default=3, ge=1, le=3, strict=True)

    @field_validator("city", "event_type", "category", mode="before")
    @classmethod
    def clean_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("language", mode="before")
    @classmethod
    def clean_optional_text(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value

    @field_validator("event_date", mode="before")
    @classmethod
    def check_calendar_date(cls, value: object) -> object:
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
            return value
        raise ValueError("event_date must be a calendar date in YYYY-MM-DD format")


class ContractorCard(BaseModel):
    id: str
    name: str
    category: str
    city: str
    price_from_kzt: int
    synthetic: bool
    explanation: str
    match_factors: List[str]
    score: float
    city_imputed: bool = False
    price_imputed: bool = False


class RecommendationResponse(BaseModel):
    status: str
    message: str
    query: RecommendationRequest
    total_category_city: int
    eligible_count: int
    results: List[ContractorCard]
    excluded_summary: dict[str, int]
    dataset_version: str | None = None


class CatalogMeta(BaseModel):
    profile_count: int
    cities: List[str]
    categories: List[str]
    event_formats: List[str]
    languages: List[str]
    dataset_version: str | None = None
