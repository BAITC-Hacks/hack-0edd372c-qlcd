"""Deterministic semantic evidence for profile-specific explanations."""
from __future__ import annotations

import re

_STOPWORDS = {"и", "в", "на", "для", "с", "по", "от", "до", "из", "а", "но", "это", "мы", "я", "у", "к", "the", "and", "for", "with", "of"}


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold().replace("ё", "е")).strip()


def tokens(value: str) -> set[str]:
    return {t for t in re.findall(r"[a-zа-я0-9]{3,}", normalize(value)) if t not in _STOPWORDS}


def description_evidence(description: str, category: str, event_type: str) -> str | None:
    terms = tokens(category) | tokens(event_type)
    sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", description).strip())
    candidates = [(len(tokens(s) & terms), -i, s) for i, s in enumerate(sentences) if tokens(s) & terms]
    if not candidates:
        return None
    return max(candidates)[2][:180].rstrip(" ,;:")
