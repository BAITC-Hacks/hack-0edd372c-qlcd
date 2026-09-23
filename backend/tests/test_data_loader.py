import csv
from pathlib import Path

import pytest

from app.data_loader import CSV_FIELDS, MAX_SAFE_INTEGER, DatasetValidationError, load_contractors


def profile(**overrides):
    row = dict(
        id="HK-test", anon_name="Тестовый подрядчик", categories="Ведущий|Музыкант",
        city="Алматы", city_imputed="False", synthetic="True", price_from_kzt="100000",
        price_imputed="False", event_formats="свадьба|корпоратив", languages="русский",
        max_hours="6.5", busy_dates="2026-09-23|2026-12-31",
        description='Работаю с музыкальной группой, программа "Живой звук".\nОпыт — 10 лет.',
    )
    row.update(overrides)
    return row


def write_csv(tmp_path, rows, *, fieldnames=CSV_FIELDS):
    path = tmp_path / "contractors.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(fieldnames)
        for row in rows:
            writer.writerow([row[key] for key in fieldnames])
    return path


def test_preserves_bom_quoted_commas_newlines_and_exact_values(tmp_path):
    row = profile(price_from_kzt=str(MAX_SAFE_INTEGER))
    contractor, = load_contractors(write_csv(tmp_path, [row]))
    assert contractor.id == "HK-test"
    assert contractor.name == "Тестовый подрядчик"
    assert contractor.description == row["description"]
    assert contractor.categories == ("Ведущий", "Музыкант")
    assert contractor.event_formats == ("свадьба", "корпоратив")
    assert contractor.languages == ("русский",)
    assert contractor.max_hours == 6.5
    assert contractor.price_from_kzt == MAX_SAFE_INTEGER
    assert contractor.busy_dates == frozenset({"2026-09-23", "2026-12-31"})
    assert contractor.synthetic is True
    assert contractor.city_imputed is False
    assert contractor.price_imputed is False


def test_explicit_zero_price_and_optional_empty_fields_are_not_missing_data(tmp_path):
    contractor, = load_contractors(write_csv(tmp_path, [profile(
        price_from_kzt="0", max_hours="", busy_dates="", description="",
    )]))
    assert contractor.price_from_kzt == 0
    assert contractor.max_hours is None
    assert contractor.busy_dates == frozenset()
    assert contractor.description == ""


@pytest.mark.parametrize(("field", "value"), [
    ("id", " \t"), ("anon_name", ""), ("city", " \n "),
    ("categories", ""), ("event_formats", "свадьба||корпоратив"),
    ("languages", "русский| "), ("categories", "Ведущий|Ведущий"),
    ("price_from_kzt", ""), ("price_from_kzt", "-1"),
    ("price_from_kzt", "1.5"), ("price_from_kzt", "1.0"),
    ("price_from_kzt", "1e5"), ("price_from_kzt", "NaN"),
    ("price_from_kzt", str(MAX_SAFE_INTEGER + 1)),
    ("price_from_kzt", "9" * 5000),
    ("max_hours", "0"), ("max_hours", "-1"), ("max_hours", "Infinity"),
    ("max_hours", "NaN"), ("max_hours", "1e999"), ("max_hours", "1e-999"),
    ("max_hours", "1_0"), ("max_hours", "invalid"),
    ("synthetic", ""), ("synthetic", "truthy"), ("city_imputed", "1"),
    ("price_imputed", "false"), ("price_imputed", "yes"),
    ("busy_dates", "2026-09-31"), ("busy_dates", "2026-9-23"),
    ("busy_dates", "20260923"), ("busy_dates", "2026-09-23T00:00:00"),
    ("busy_dates", "2026-09-22"), ("busy_dates", "2027-01-01"),
    ("busy_dates", "2026-10-10|2026-10-10"), ("busy_dates", "2026-10-10|"),
])
def test_invalid_record_identifies_path_physical_line_and_column(tmp_path, field, value):
    path = write_csv(tmp_path, [profile(**{field: value})])
    with pytest.raises(DatasetValidationError) as caught:
        load_contractors(path)
    error = caught.value
    assert error.path == path
    assert error.line == 2
    assert error.column == field
    assert str(path) in str(error)
    assert f"line 2, column {field}" in str(error)


def test_duplicate_id_reports_first_line_and_physical_line_after_multiline_description(tmp_path):
    path = write_csv(tmp_path, [profile(), profile(anon_name="Другой подрядчик")])
    with pytest.raises(DatasetValidationError) as caught:
        load_contractors(path)
    assert caught.value.line == 4
    assert caught.value.column == "id"
    assert "first seen on line 2" in str(caught.value)


@pytest.mark.parametrize("fieldnames", [
    CSV_FIELDS[:-1], CSV_FIELDS + ("extra",), CSV_FIELDS + ("id",),
])
def test_rejects_missing_extra_and_duplicate_headers(tmp_path, fieldnames):
    path = write_csv(tmp_path, [], fieldnames=fieldnames)
    with pytest.raises(DatasetValidationError) as caught:
        load_contractors(path)
    assert caught.value.line == 1
    assert caught.value.column == "<header>"


@pytest.mark.parametrize("record", ["only,three,values\n", "," * 13 + "\n", "\n", '"unclosed quote\n'])
def test_rejects_malformed_csv_instead_of_filling_fields(tmp_path, record):
    path = write_csv(tmp_path, [])
    with path.open("a", encoding="utf-8", newline="") as handle:
        handle.write(record)
    with pytest.raises(DatasetValidationError) as caught:
        load_contractors(path)
    assert caught.value.line == 2
    assert caught.value.column == "<record>"


@pytest.mark.parametrize("contents", ["", ",".join(CSV_FIELDS) + "\n"])
def test_rejects_empty_catalog(tmp_path, contents):
    path = tmp_path / "empty.csv"
    path.write_text(contents, encoding="utf-8")
    with pytest.raises(DatasetValidationError, match="missing header|no contractor profiles"):
        load_contractors(path)


def test_current_catalog_still_loads_all_original_profiles():
    path = Path(__file__).parents[1] / "data" / "contractors.csv"
    contractors = load_contractors(path)
    assert len(contractors) == 66
    assert len({contractor.id for contractor in contractors}) == 66
    assert sum(contractor.synthetic for contractor in contractors) == 13
