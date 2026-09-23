from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional


def _split(value: str) -> list[str]:
    return [part.strip() for part in (value or "").split("|") if part.strip()]


def _bool(value: str) -> bool:
    return str(value).strip().lower() in {"true", "1", "yes", "да"}


@dataclass(frozen=True)
class Contractor:
    id: str
    name: str
    categories: tuple[str, ...]
    city: str
    price_from_kzt: int
    event_formats: tuple[str, ...]
    languages: tuple[str, ...]
    max_hours: Optional[float]
    busy_dates: frozenset[str]
    description: str
    synthetic: bool
    city_imputed: bool
    price_imputed: bool


def load_contractors(path: Path) -> List[Contractor]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        contractors: list[Contractor] = []
        for row in csv.DictReader(handle):
            raw_hours = (row.get("max_hours") or "").strip()
            contractors.append(Contractor(
                id=row["id"].strip(), name=row["anon_name"].strip(),
                categories=tuple(_split(row.get("categories", ""))), city=row.get("city", "").strip(),
                price_from_kzt=int(float(row.get("price_from_kzt", "0") or 0)),
                event_formats=tuple(_split(row.get("event_formats", ""))),
                languages=tuple(_split(row.get("languages", ""))),
                max_hours=float(raw_hours) if raw_hours else None,
                busy_dates=frozenset(_split(row.get("busy_dates", ""))),
                description=(row.get("description") or "").strip(),
                synthetic=_bool(row.get("synthetic", "false")),
                city_imputed=_bool(row.get("city_imputed", "false")),
                price_imputed=_bool(row.get("price_imputed", "false")),
            ))
    if not contractors:
        raise ValueError(f"No contractor profiles found in {path}")
    return contractors


def unique_values(contractors: Iterable[Contractor], field: str) -> list[str]:
    values: set[str] = set()
    for contractor in contractors:
        values.update(getattr(contractor, field))
    return sorted(values, key=str.casefold)
