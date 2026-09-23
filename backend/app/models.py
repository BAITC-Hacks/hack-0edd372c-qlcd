from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class RecommendationRequest(BaseModel):
    city: str = Field(min_length=1)
    event_date: date
    event_type: str = Field(min_length=1)
    category: str = Field(min_length=1)
    budget_kzt: int = Field(gt=0)
    duration_hours: Optional[float] = Field(default=None, gt=0)
    language: Optional[str] = None
    limit: int = Field(default=3, ge=1, le=3)

    @field_validator("city", "event_type", "category", "language")
    @classmethod
    def clean_text(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value else value


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


class RecommendationResponse(BaseModel):
    status: str
    message: str
    query: RecommendationRequest
    total_category_city: int
    eligible_count: int
    results: List[ContractorCard]
    excluded_summary: dict[str, int]


class CatalogMeta(BaseModel):
    profile_count: int
    cities: List[str]
    categories: List[str]
    event_formats: List[str]
    languages: List[str]
