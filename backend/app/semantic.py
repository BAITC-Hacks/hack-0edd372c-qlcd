"""Deterministic extractive evidence: complete source facts, no remote model.

The explicit vocabulary describes service features, not contractor IDs.
Operational constraints come from the structured catalogue, never from this text.
"""
from __future__ import annotations

from dataclasses import dataclass
import re


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold().replace("ё", "е")).strip()


def tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-zа-я0-9]{3,}", normalize(value)))


# A feature must say more than "a professional photographer" or "an ideal event".
# Overlapping vocabulary is intentional: instruments also describe band line-ups.
_FEATURES = {
    "experience": r"(?:\d+|семи|шести|десятилетн|шестилетн)[ -]*(?:лет|год|летн)|\d+[ -]*(?:заказ|съем|свад|мероприят)",
    "lineup": r"состав|дуэт|трио|trio|quartet|quintet|квартет|вокалист|перкусси|звукорежиссер",
    "instruments": r"скрипк|саксофон|контрабас|домбр|барабан|гитар|тромбон|клавиш|духов(?:ой|ые|ых).{0,8}(?:брасс|инструмент)|\bтруб[аыуе]\b",
    "repertoire": r"репертуар|ретро|джаз|кавер|этни[кч]|народн.{0,20}мелод|казахск.{0,15}песн|песн.{0,15}казахск",
    "performance": r"импровизац|интерактив|хореограф|сценари|юмор|развлечен|танц|европейск.{0,12}подач|спокойн.{0,15}подач",
    "visual_style": r"фотожурнализм|документальн|репортаж|постановоч|позирован|семейн.{0,15}съем|портрет|love story|студи[ияю]|fashion week",
    "flowers": r"сезонн.{0,15}цвет|привозн.{0,15}цвет|букет|палитр|президиум|композици.{0,20}(?:стил|цвет)",
    "production": r"эскиз|монтаж|демонтаж|инсталляц|неонов|шар-гирлянд|тканев|металлокаркас|подиум|арки|конструкци|сценограф",
    "gifts": r"изомальт|леденц|без сахар|именн.{0,15}открытк|карточк.{0,15}рассад|фотомагнит|значк|блокнот|логотип|минимальн.{0,15}(?:заказ|тираж)",
    "equipment": r"мультимедийн|оборудован|техническ.{0,15}оснащ|пиксельн|сенсорн|фотобудк|печат[ьи]|брендированн.{0,15}рамк|зеркальн|неонов",
    "venue": r"террас|панорам|гольф|парковк|кейтеринг|банкетн.{0,10}зал|юрт[ауыо]|кухн|вместимост|\d+\s*гост",
    "credentials": r"резидент|финалист|победител|преми[ия]|номинаци|театр|телеведущ|телеканал|портфолио|глав[оа][йы] государства|первых лиц государства|\b(?:топ|top)[ -]*\d|colorist of the year\s+\d",
    "ceremony": r"выездн.{0,15}регистрац|бракосочетан|истори.{0,15}(?:пар|молодожен)|без спешки",
}
_PATTERNS = {name: re.compile(pattern) for name, pattern in _FEATURES.items()}
_CATEGORY_FEATURES = {
    "ведущий": {"experience", "performance", "credentials", "equipment"},
    "ведущий церемонии": {"ceremony", "performance", "experience"},
    "фотограф": {"visual_style", "experience", "credentials"},
    "видеограф": {"visual_style", "experience", "credentials"},
    "флорист": {"flowers", "production", "experience"},
    "декоратор": {"production", "equipment", "experience"},
    "подарки и сувениры": {"gifts", "production"},
    "фото и видеобудки": {"equipment", "visual_style"},
    "лайв-бэнд": {"lineup", "instruments", "repertoire", "performance"},
    "инструменталист": {"lineup", "instruments", "repertoire"},
    "национальный ансамбль": {"lineup", "repertoire", "performance", "credentials"},
    "танцевальный коллектив": {"lineup", "performance", "credentials"},
    "шоу-программа": {"performance", "equipment", "lineup", "credentials"},
    "банкетный зал": {"venue", "equipment"},
    "ресторан": {"venue"},
    "отель": {"venue", "equipment"},
    "загородная площадка": {"venue", "equipment"},
}
_EVENT_STEMS = {
    "свадьба": ("свад", "невест", "молодожен", "бракосочет"),
    "корпоратив": ("корпоратив", "делов", "бизнес", "конференц", "презентац"),
    "юбилей": ("юбиле",),
}
_GREETING_OR_SLOGAN = re.compile(
    r"привет|меня зовут|дорогу осилит|проводы осилит|любимое выражение|с уважением|"
    r"свяжитесь|до встречи|идеально впишется|незабываем.{0,20}(?:впечатлен|звучан)|"
    r"если вам нужен|если хотите|ваш праздник.{0,20}руках"
)
# Do not use unstructured availability, prices, languages or duration as proof.
_STRUCTURED_CLAIM = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:час|ч\b|₸|тенге|kzt)|"
    r"\bцен[аыу]|стоимост|бюджет|язык|каз/рус|свободен|занят.{0,12}дат|"
    r"(?:работаю|работаем|снимаю|нахожусь|находимся)\s+(?:только\s+)?в\s"
)


@dataclass(frozen=True)
class ProfileEvidence:
    text: str
    relevant: bool


def source_fragments(description: str) -> list[str]:
    """Split at sentence/bullet/list-heading boundaries, never a character limit."""
    parts = re.split(
        r"[\n\r•]+|(?<=[.!?])(?<!\bг\.)(?<!\bтыс\.)(?<!\bт\.)(?<!\bд\.)(?:\s+|(?=[А-ЯЁA-Z]))|"
        r"(?<!^)(?=Расширенный состав|Большой состав|Большой музыкальный состав|Репертуар[: ]|Форматы:)",
        description,
    )
    return [re.sub(r"\s+", " ", part).strip() for part in parts if part.strip()]


def select_evidence(description: str, category: str, event_type: str) -> ProfileEvidence | None:
    """Select a concrete feature with deterministic category/event relevance.

    Category vocabulary includes domain synonyms and inflected stems. Repeating
    a category/event token alone never qualifies as substantive evidence.
    """
    category_features = _CATEGORY_FEATURES.get(normalize(category), set())
    event_stems = _EVENT_STEMS.get(normalize(event_type), ())
    candidates: list[tuple[tuple[int, int, int, int], ProfileEvidence]] = []
    for position, text in enumerate(source_fragments(description)):
        normalized = normalize(text)
        if _GREETING_OR_SLOGAN.search(normalized) or _STRUCTURED_CLAIM.search(normalized):
            continue
        features = {key for key, pattern in _PATTERNS.items() if pattern.search(normalized)}
        if not features:
            continue
        relevant_features = features & category_features
        event_match = any(stem in normalized for stem in event_stems)
        # Actual line-ups beat generic repertoires shared across bands.
        specific = len(relevant_features) * 3
        specific += 5 * bool("lineup" in relevant_features and "instruments" in features)
        specific += 3 * bool(re.search(r"\d", normalized))
        specific += 2 * bool(relevant_features & {"flowers", "production", "equipment", "ceremony"})
        rank = (bool(relevant_features), specific, int(event_match), -position)
        candidates.append((rank, ProfileEvidence(text, bool(relevant_features) or event_match)))
    return max(candidates, key=lambda candidate: candidate[0])[1] if candidates else None


def description_evidence(description: str, category: str, event_type: str) -> str | None:
    """Backward-compatible text-only helper."""
    evidence = select_evidence(description, category, event_type)
    return evidence.text if evidence else None
