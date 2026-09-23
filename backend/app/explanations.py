from __future__ import annotations

from .data_loader import Contractor
from .semantic import description_evidence


def build_explanation(contractor: Contractor, *, event_type: str, budget_kzt: int, duration_hours: float | None, language: str | None) -> tuple[str, list[str]]:
    factors: list[str] = ["availability"]
    reasons: list[str] = ["Свободен на выбранную дату"]
    if contractor.price_from_kzt <= budget_kzt:
        factors.append("budget")
        reasons.append(f"цена от {contractor.price_from_kzt:,} ₸ укладывается в бюджет {budget_kzt:,} ₸")
    if event_type.casefold() in {x.casefold() for x in contractor.event_formats}:
        factors.append("format")
        reasons.append(f"профиль принимает формат «{event_type}»")
    if language and language.casefold() in {x.casefold() for x in contractor.languages}:
        factors.append("language")
        reasons.append(f"работает на языке «{language}»")
    if duration_hours is not None and contractor.max_hours is not None and duration_hours <= contractor.max_hours:
        factors.append("duration")
        reasons.append(f"лимит площадки {contractor.max_hours:g} ч подходит под запрос на {duration_hours:g} ч")
    first_sentence = reasons[0] + "; " + ", ".join(reasons[1:]) + "."
    evidence = description_evidence(contractor.description, contractor.categories[0], event_type)
    if evidence:
        factors.append("profile")
        return first_sentence + f" Из описания профиля: «{evidence}»." , factors
    return first_sentence, factors