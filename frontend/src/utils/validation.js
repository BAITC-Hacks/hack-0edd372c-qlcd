export const MIN_DATE = '2026-09-23';
export const MAX_DATE = '2026-12-31';

export function validDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split('-').map(Number);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function serializeRequest(fields, metadata) {
  const errors = {};
  for (const [field, options] of [['city', 'cities'], ['eventType', 'eventFormats'], ['category', 'categories']]) {
    if (!fields[field] || (metadata && !metadata[options].includes(fields[field]))) errors[field] = 'Выберите значение из списка.';
  }
  if (!validDate(fields.date) || fields.date < MIN_DATE || fields.date > MAX_DATE) errors.date = 'Выберите дату с 23.09.2026 по 31.12.2026.';
  const rawBudget = fields.budget.trim();
  // Spaces may only be thousands separators, not arbitrary digit concatenation.
  const grouped = /^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)$/.test(rawBudget);
  const budget = Number(rawBudget.replace(/[ \u00a0\u202f]/g, ''));
  if (!rawBudget || !grouped || !Number.isSafeInteger(budget) || budget <= 0) errors.budget = 'Введите целое число тенге больше нуля, без потери точности.';
  const rawDuration = fields.duration.trim().replace(',', '.');
  const duration = rawDuration ? Number(rawDuration) : null;
  if (rawDuration && (!/^\d+(?:\.\d+)?$/.test(rawDuration) || !Number.isFinite(duration) || duration <= 0)) errors.duration = 'Введите положительное число часов, например 6,5, или оставьте поле пустым.';
  if (fields.language && metadata && !metadata.languages.includes(fields.language)) errors.language = 'Выберите один язык из списка.';
  return { errors, request: Object.keys(errors).length ? null : {
    city: fields.city, event_date: fields.date, event_type: fields.eventType, category: fields.category,
    budget_kzt: budget, duration_hours: duration, language: fields.language || null, limit: 3,
  } };
}
