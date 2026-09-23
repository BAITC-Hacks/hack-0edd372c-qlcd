from __future__ import annotations

from .data_loader import Contractor
from .semantic import select_evidence


def build_explanation(contractor: Contractor, *, category: str, event_type: str, budget_kzt: int, duration_hours: float | None, language: str | None) -> tuple[str, list[str]]:
    factors: list[str] = ["availability"]
    reasons: list[str] = ["Свободен на выбранную дату по календарю датасета"]
    if contractor.price_from_kzt <= budget_kzt:
        factors.append("budget")
        reasons.append(f"цена от {contractor.price_from_kzt:,} ₸ укладывается в бюджет {budget_kzt:,} ₸")
    if event_type.casefold() in {x.casefold() for x in contractor.event_formats}:
        factors.append("format")
        reasons.append(f"профиль принимает формат «{event_type}»")
    if language and language.casefold() in {x.casefold() for x in contractor.languages}:
        factors.append("language")
        reasons.append(f"в каталоге указан язык «{language}»")
    if duration_hours is not None and contractor.max_hours is not None and duration_hours <= contractor.max_hours:
        factors.append("duration")
        reasons.append(f"указанный лимит {contractor.max_hours:g} ч подходит под запрос на {duration_hours:g} ч")
    elif duration_hours is not None and contractor.max_hours is None:
        reasons.append("ограничение длительности в каталоге не задано")
    first_sentence = reasons[0] + "; " + ", ".join(reasons[1:]) + "."
    evidence = select_evidence(contractor.description, category, event_type)
    if evidence:
        factors.append("profile")
        if evidence.relevant:
            factors.append("relevant_profile")
        return first_sentence + f" Особенность из описания профиля: «{evidence.text}».", factors
    return first_sentence + " В описании недостаточно конкретных сведений об особенностях услуги; рекомендация опирается на параметры каталога.", factors
