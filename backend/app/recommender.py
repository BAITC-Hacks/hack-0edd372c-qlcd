from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from .data_loader import Contractor
from .explanations import build_explanation
from .models import ContractorCard, RecommendationRequest, RecommendationResponse


def _same(value: str, options: tuple[str, ...]) -> bool:
    return value.casefold() in {option.casefold() for option in options}


@dataclass(frozen=True)
class _Scored:
    contractor: Contractor
    score: float
    factors: list[str]
    explanation: str


def recommend(request: RecommendationRequest, contractors: list[Contractor]) -> RecommendationResponse:
    category_city = [x for x in contractors if _same(request.city, (x.city,)) and _same(request.category, x.categories)]
    if not category_city:
        return RecommendationResponse(status="no_category_in_city", message=f"В городе «{request.city}» нет подрядчиков категории «{request.category}».", query=request, total_category_city=0, eligible_count=0, results=[], excluded_summary={})
    excluded = Counter()
    scored: list[_Scored] = []
    for item in category_city:
        if request.event_date.isoformat() in item.busy_dates:
            excluded["booked"] += 1; continue
        if item.price_from_kzt > request.budget_kzt:
            excluded["over_budget"] += 1; continue
        if not _same(request.event_type, item.event_formats):
            excluded["format"] += 1; continue
        if request.language and not _same(request.language, item.languages):
            excluded["language"] += 1; continue
        if request.duration_hours is not None and item.max_hours is not None and request.duration_hours > item.max_hours:
            excluded["duration"] += 1; continue
        explanation, factors = build_explanation(item, event_type=request.event_type, budget_kzt=request.budget_kzt, duration_hours=request.duration_hours, language=request.language)
        score = 30 + 25 + (20 if request.language else 0) + (15 if request.duration_hours is None or item.max_hours is None else 15) + min(10, len(factors) * 2)
        scored.append(_Scored(item, score, factors, explanation))
    scored.sort(key=lambda x: (-x.score, x.contractor.price_from_kzt, x.contractor.id))
    cards = [ContractorCard(id=x.contractor.id, name=x.contractor.name, category=request.category, city=x.contractor.city, price_from_kzt=x.contractor.price_from_kzt, synthetic=x.contractor.synthetic, explanation=x.explanation, match_factors=x.factors, score=x.score) for x in scored[:request.limit]]
    if cards:
        status = "matches_found"; message = f"Найдено {len(scored)} подходящих профилей; показаны лучшие {len(cards)} по прозрачному баллу соответствия."
    else:
        status = "no_candidates_meet_conditions"; details = ", ".join(f"{count} — {label}" for label, count in excluded.items()); message = f"Категория есть в городе, но подходящих профилей нет: {details}."
    return RecommendationResponse(status=status, message=message, query=request, total_category_city=len(category_city), eligible_count=len(scored), results=cards, excluded_summary=dict(excluded))
