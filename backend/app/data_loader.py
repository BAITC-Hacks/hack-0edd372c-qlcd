from __future__ import annotations

import csv
import math
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable, List, Optional


CALENDAR_START = date(2026, 9, 23)
CALENDAR_END = date(2026, 12, 31)
# API prices and budgets must survive a JSON round trip through JavaScript.
MAX_SAFE_INTEGER = 2**53 - 1
CSV_FIELDS = (
    "id", "anon_name", "categories", "city", "city_imputed", "synthetic",
    "price_from_kzt", "price_imputed", "event_formats", "languages",
    "max_hours", "busy_dates", "description",
)
_INTEGER = re.compile(r"[0-9]+")
_NUMBER = re.compile(r"[+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?")
_ISO_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")


class DatasetValidationError(ValueError):
    """An invalid CSV record, including its physical line and field."""

    def __init__(self, path: Path, line: int, column: str, reason: str):
        self.path = path
        self.line = line
        self.column = column
        super().__init__(f"{path}: line {line}, column {column}: {reason}")


def _split(value: str, path: Path, line: int, column: str, *, allow_empty: bool = False) -> tuple[str, ...]:
    if not value and allow_empty:
        return ()
    parts = tuple(part.strip() for part in value.split("|"))
    if any(not part for part in parts):
        raise DatasetValidationError(path, line, column, "expected non-empty values separated by '|'")
    if len(set(parts)) != len(parts):
        raise DatasetValidationError(path, line, column, "duplicate values are not allowed")
    return parts


def _bool(value: str, path: Path, line: int, column: str) -> bool:
    if value not in {"True", "False"}:
        raise DatasetValidationError(path, line, column, "expected True or False")
    return value == "True"


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
    path = Path(path)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, strict=True)
        contractors: list[Contractor] = []
        seen_ids: dict[str, int] = {}

        def read_record() -> list[str] | None:
            line = reader.line_num + 1
            try:
                return next(reader)
            except StopIteration:
                return None
            except (csv.Error, UnicodeError) as exc:
                raise DatasetValidationError(path, line, "<record>", f"invalid UTF-8 CSV: {exc}") from exc

        header = read_record()
        if header is None:
            raise DatasetValidationError(path, 1, "<header>", "missing header")
        if len(set(header)) != len(header):
            raise DatasetValidationError(path, 1, "<header>", "duplicate column names")
        missing = set(CSV_FIELDS) - set(header)
        unexpected = set(header) - set(CSV_FIELDS)
        if missing or unexpected:
            details = []
            if missing:
                details.append(f"missing columns: {', '.join(sorted(missing))}")
            if unexpected:
                details.append(f"unexpected columns: {', '.join(sorted(unexpected))}")
            raise DatasetValidationError(path, 1, "<header>", "; ".join(details))

        while True:
            line = reader.line_num + 1
            values = read_record()
            if values is None:
                break
            if len(values) != len(header):
                raise DatasetValidationError(path, line, "<record>", f"expected {len(header)} fields, found {len(values)}")
            row = {key: value.strip() for key, value in zip(header, values)}
            for column in ("id", "anon_name", "city"):
                if not row[column]:
                    raise DatasetValidationError(path, line, column, "must not be empty")
            if row["id"] in seen_ids:
                raise DatasetValidationError(path, line, "id", f"duplicate id {row['id']!r}; first seen on line {seen_ids[row['id']]}")
            seen_ids[row["id"]] = line

            raw_price = row["price_from_kzt"]
            canonical_price = raw_price.lstrip("0") or "0"
            if not _INTEGER.fullmatch(raw_price) or len(canonical_price) > len(str(MAX_SAFE_INTEGER)):
                raise DatasetValidationError(path, line, "price_from_kzt", f"expected an integer between 0 and {MAX_SAFE_INTEGER}")
            price = int(canonical_price)
            if not 0 <= price <= MAX_SAFE_INTEGER:
                raise DatasetValidationError(path, line, "price_from_kzt", f"expected an integer between 0 and {MAX_SAFE_INTEGER}")

            raw_hours = row["max_hours"]
            hours = None
            if raw_hours:
                if not _NUMBER.fullmatch(raw_hours):
                    raise DatasetValidationError(path, line, "max_hours", "expected a finite positive number or an empty field")
                hours = float(raw_hours)
                if not math.isfinite(hours) or hours <= 0:
                    raise DatasetValidationError(path, line, "max_hours", "expected a finite positive number or an empty field")

            busy_dates = _split(row["busy_dates"], path, line, "busy_dates", allow_empty=True)
            for busy_date in busy_dates:
                try:
                    if not _ISO_DATE.fullmatch(busy_date):
                        raise ValueError("expected YYYY-MM-DD")
                    parsed_date = date.fromisoformat(busy_date)
                except ValueError as exc:
                    raise DatasetValidationError(path, line, "busy_dates", f"invalid ISO calendar date {busy_date!r}") from exc
                if not CALENDAR_START <= parsed_date <= CALENDAR_END:
                    raise DatasetValidationError(path, line, "busy_dates", f"date {busy_date!r} must be between {CALENDAR_START} and {CALENDAR_END}")

            contractors.append(Contractor(
                id=row["id"], name=row["anon_name"],
                categories=_split(row["categories"], path, line, "categories"), city=row["city"],
                price_from_kzt=price,
                event_formats=_split(row["event_formats"], path, line, "event_formats"),
                languages=_split(row["languages"], path, line, "languages"),
                max_hours=hours,
                busy_dates=frozenset(busy_dates),
                description=row["description"],
                synthetic=_bool(row["synthetic"], path, line, "synthetic"),
                city_imputed=_bool(row["city_imputed"], path, line, "city_imputed"),
                price_imputed=_bool(row["price_imputed"], path, line, "price_imputed"),
            ))
    if not contractors:
        raise DatasetValidationError(path, 2, "<record>", "no contractor profiles found")
    return contractors


def unique_values(contractors: Iterable[Contractor], field: str) -> list[str]:
    values: set[str] = set()
    for contractor in contractors:
        value = getattr(contractor, field)
        if isinstance(value, str):
            values.add(value)
        else:
            values.update(value)
    return sorted(values, key=str.casefold)
