import localCities from './data/cities.json';

export class ContractError extends Error {
  constructor(field) {
    super(`Ошибка контракта API: некорректное поле «${field}». Выдача не показана.`);
    this.name = 'ContractError';
  }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const strings = value => Array.isArray(value) && value.length > 0 && value.every(text) && new Set(value).size === value.length;
function requireField(condition, field) { if (!condition) throw new ContractError(field); }
const sorted = array => [...array].sort((a, b) => a.localeCompare(b, 'ru'));

export const rejectionLabels = {
  booked: 'Заняты на выбранную дату',
  over_budget: 'Стартовая цена выше бюджета',
  format: 'Формат не поддерживается',
  language: 'Язык не указан в профиле',
  duration: 'Длительность превышает максимум',
};

export function adaptMetadata(raw) {
  requireField(object(raw), 'meta');
  requireField(count(raw.profile_count), 'profile_count');
  for (const key of ['cities', 'categories', 'event_formats', 'languages']) requireField(strings(raw[key]), key);
  // Confirmed defect in backend/app/data_loader.py: update(str) splits city names.
  // This is reference metadata only, never a fallback recommendation catalog.
  const brokenCities = raw.cities.every(city => [...city].length === 1);
  return {
    cities: sorted(brokenCities ? localCities.cities : raw.cities),
    categories: sorted(raw.categories), eventFormats: sorted(raw.event_formats), languages: sorted(raw.languages),
    profileCount: raw.profile_count,
    notice: brokenCities ? 'API вернул отдельные буквы вместо городов. Список городов взят из CSV проекта; версия каталога сервера не подтверждена.' : null,
    source: brokenCities ? localCities : null,
  };
}

const statuses = { matches_found: 'matches_found', no_category_in_city: 'category_not_found', no_candidates_meet_conditions: 'no_eligible_candidates' };
export function adaptResponse(raw, request) {
  requireField(object(raw), 'response');
  requireField(Object.hasOwn(statuses, raw.status), 'status');
  requireField(text(raw.message), 'message');
  requireField(object(raw.query), 'query');
  for (const key of Object.keys(request)) requireField(raw.query[key] === request[key], `query.${key}`);
  requireField(count(raw.total_category_city), 'total_category_city');
  requireField(count(raw.eligible_count) && raw.eligible_count <= raw.total_category_city, 'eligible_count');
  requireField(object(raw.excluded_summary), 'excluded_summary');
  for (const [reason, value] of Object.entries(raw.excluded_summary)) {
    requireField(Object.hasOwn(rejectionLabels, reason), 'excluded_summary (неизвестная причина)');
    requireField(count(value), `excluded_summary.${reason}`);
  }
  requireField(raw.total_category_city === raw.eligible_count + Object.values(raw.excluded_summary).reduce((a, b) => a + b, 0), 'excluded_summary (баланс)');
  requireField(Array.isArray(raw.results) && raw.results.length <= 3, 'results');
  requireField(new Set(raw.results.map(card => card?.id)).size === raw.results.length, 'results.id (дубликаты)');
  const status = statuses[raw.status];
  if (status === 'matches_found') {
    requireField(raw.eligible_count > 0 && raw.results.length === Math.min(3, raw.eligible_count), 'results (число карточек)');
  } else {
    requireField(raw.results.length === 0 && raw.eligible_count === 0, 'results (пустой исход)');
    requireField(status === 'category_not_found' ? raw.total_category_city === 0 : raw.total_category_city > 0, 'total_category_city (статус)');
  }
  const cards = raw.results.map(card => {
    requireField(object(card), 'card');
    for (const field of ['id', 'name', 'category', 'city', 'explanation']) requireField(text(card[field]), `card.${field}`);
    requireField(card.city === request.city && card.category === request.category, 'card.city/category');
    requireField(count(card.price_from_kzt) && card.price_from_kzt <= request.budget_kzt, 'card.price_from_kzt');
    requireField(typeof card.synthetic === 'boolean', 'card.synthetic');
    requireField(Array.isArray(card.match_factors) && card.match_factors.every(text), 'card.match_factors');
    requireField(typeof card.score === 'number' && Number.isFinite(card.score), 'card.score');
    for (const field of ['city_imputed', 'price_imputed']) {
      if (Object.hasOwn(card, field)) requireField(typeof card[field] === 'boolean', `card.${field}`);
    }
    return { ...card }; // Preserve backend order, explanation and optional facts.
  });
  if (raw.dataset_version !== undefined) requireField(text(raw.dataset_version), 'dataset_version');
  return {
    status, cards, summary: raw.message, datasetVersion: raw.dataset_version ?? null,
    trace: { total: raw.total_category_city, eligible: raw.eligible_count, rejected: { ...raw.excluded_summary }, mode: 'first_failure' },
  };
}
