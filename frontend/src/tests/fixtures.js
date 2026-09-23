// Synthetic test data. This module is never imported by application code.
import { initialFields } from '../data/demoPresets';
import { serializeRequest } from '../utils/validation';

export const request = serializeRequest(initialFields).request;
export const meta = { profile_count: 4, cities: ['Алматы', 'Астана'], categories: ['Ведущий', 'Флорист', 'Инструменталист', 'Банкетный зал'], event_formats: ['корпоратив', 'свадьба'], languages: ['русский', 'казахский'] };
export function response(overrides = {}) {
  return {
    status: 'matches_found', message: 'Подходит один профиль.', query: { ...request },
    total_category_city: 2, eligible_count: 1, excluded_summary: { booked: 1 },
    results: [{ id: 'TEST-1', name: 'Тестовый ведущий', category: 'Ведущий', city: 'Алматы', price_from_kzt: 300000, synthetic: false, explanation: 'Начальная цена укладывается в бюджет. В описании указана импровизация.', match_factors: ['availability', 'budget'], score: 90 }],
    ...overrides,
  };
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
