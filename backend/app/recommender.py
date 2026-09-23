from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from .data_loader import Contractor
from .explanations import build_explanation
from .models import ContractorCard, RecommendationRequest, RecommendationResponse

EXCLUSION_LABELS = {
    "booked": "занят на выбранную дату",
    "over_budget": "цена выше бюджета",
    "format": "не поддерживает формат",
    "language": "не поддерживает язык",
    "duration": "не подходит по длительности",
}


def _same(value: str, options: tuple[str, ...]) -> bool:
    return value.casefold() in {option.casefold() for option in options}


@dataclass(frozen=True)
class _Scored:
    contractor: Contractor
    score: float
    factors: list[str]
    explanation: str


def _score(item: Contractor, request: RecommendationRequest, factors: list[str]) -> float:
    # Hard constraints were already passed. Soft score rewards budget headroom,
    # requested language/duration fit, and evidence in the profile description.
    budget_headroom = max(0.0, 30.0 * (1 - item.price_from_kzt / request.budget_kzt))
    language_fit = 20.0 if request.language else 0.0
    if request.duration_hours is None:
        duration_fit = 5.0
    elif item.max_hours is None:
        duration_fit = 10.0
    else:
        slack = max(0.0, item.max_hours - request.duration_hours)
        duration_fit = min(15.0, 5.0 + 10.0 * slack / max(item.max_hours, 1.0))
    evidence_fit = 15.0 if "profile" in factors else 0.0
    return round(budget_headroom + language_fit + duration_fit + evidence_fit, 2)


def recommend(request: RecommendationRequest, contractors: list[Contractor], dataset_version: str | None = None) -> RecommendationResponse:
    category_city = [x for x in contractors if _same(request.city, (x.city,)) and _same(request.category, x.categories)]
    if not category_city:
        return RecommendationResponse(
            status="no_category_in_city",
            message=f"В городе «{request.city}» нет подрядчиков категории «{request.category}».",
            query=request, total_category_city=0, eligible_count=0, results=[], excluded_summary={}, dataset_version=dataset_version,
        )

    excluded = Counter()
    scored: list[_Scored] = []
    for item in category_city:
        if request.event_date.isoformat() in item.busy_dates:
            excluded["booked"] += 1
            continue
        if item.price_from_kzt > request.budget_kzt:
            excluded["over_budget"] += 1
            continue
        if not _same(request.event_type, item.event_formats):
            excluded["format"] += 1
            continue
        if request.language and not _same(request.language, item.languages):
            excluded["language"] += 1
            continue
        if request.duration_hours is not None and item.max_hours is not None and request.duration_hours > item.max_hours:
            excluded["duration"] += 1
            continue
        explanation, factors = build_explanation(item, event_type=request.event_type, budget_kzt=request.budget_kzt, duration_hours=request.duration_hours, language=request.language)
        scored.append(_Scored(item, _score(item, request, factors), factors, explanation))

    scored.sort(key=lambda x: (-x.score, x.contractor.price_from_kzt, x.contractor.id))
    cards = [ContractorCard(
        id=x.contractor.id, name=x.contractor.name, category=request.category, city=x.contractor.city,
        price_from_kzt=x.contractor.price_from_kzt, synthetic=x.contractor.synthetic,
        explanation=x.explanation, match_factors=x.factors, score=x.score,
        city_imputed=x.contractor.city_imputed, price_imputed=x.contractor.price_imputed,
    ) for x in scored[:request.limit]]

    if cards:
        status = "matches_found"
        message = f"Найдено {len(scored)} подходящих профилей; показаны лучшие {len(cards)} по прозрачному баллу соответствия."
    else:
        details = ", ".join(f"{EXCLUSION_LABELS.get(label, label)}: {count}" for label, count in excluded.items())
        status = "no_candidates_meet_conditions"
        message = f"Категория есть в городе, но подходящих профилей нет: {details}."

    return RecommendationResponse(
        status=status, message=message, query=request,
        total_category_city=len(category_city), eligible_count=len(scored),
        results=cards, excluded_summary=dict(excluded), dataset_version=dataset_version,
    )