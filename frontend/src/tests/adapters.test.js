import { expect, it } from 'vitest';
import { adaptMetadata, adaptResponse, ContractError } from '../adapters';
import { meta, request, response } from './fixtures';

it('preserves backend order and full explanation', () => {
  const first = response().results[0];
  const raw = response({ eligible_count: 2, excluded_summary: {}, results: [{ ...first, id: 'Z' }, { ...first, id: 'A' }] });
  const result = adaptResponse(raw, request);
  expect(result.cards.map(card => card.id)).toEqual(['Z', 'A']);
  expect(result.cards[0].explanation).toBe(first.explanation);
  expect(result.cards[0]).not.toHaveProperty('price_imputed');
});
it.each([
  ['no_category_in_city', 0, {}, 'category_not_found'],
  ['no_candidates_meet_conditions', 2, { booked: 1, over_budget: 1 }, 'no_eligible_candidates'],
])('maps %s without guessing from empty arrays', (status, total, excluded, expected) => {
  expect(adaptResponse(response({ status, total_category_city: total, eligible_count: 0, excluded_summary: excluded, results: [] }), request).status).toBe(expected);
});
it.each([
  raw => { raw.status = 'unknown'; },
  raw => { raw.results[0].explanation = ' '; },
  raw => { raw.results[0].synthetic = 'False'; },
  raw => { raw.results[0].city = 'Астана'; },
  raw => { raw.results[0].category = 'Флорист'; },
  raw => { raw.results[0].price_from_kzt = 99999999; },
  raw => { raw.results[0].city_imputed = 'False'; },
  raw => { raw.results[0].score = Infinity; },
  raw => { raw.results.push(raw.results[0]); },
  raw => { raw.results = Array(4).fill(raw.results[0]); },
  raw => { raw.eligible_count = 0; },
  raw => { raw.excluded_summary = { booked: 2 }; },
  raw => { raw.excluded_summary = { invented: 1 }; },
  raw => { delete raw.total_category_city; },
  raw => { raw.query.budget_kzt = 1; },
])('rejects invalid response rather than repairing it', mutate => {
  const raw = response(); mutate(raw);
  expect(() => adaptResponse(raw, request)).toThrow(ContractError);
});
it('uses the working metadata endpoint and documents only the city defect', () => {
  expect(adaptMetadata(meta).cities).toEqual(['Алматы', 'Астана']);
  const broken = adaptMetadata({ ...meta, cities: ['А', 'л', 'м'] });
  expect(broken.cities).toContain('Астана');
  expect(broken.notice).toContain('не подтверждена');
  expect(broken.source.sha256).toHaveLength(64);
  expect(() => adaptMetadata({})).toThrow(ContractError);
});

it('accepts the nullable dataset version declared by the API schema', () => {
  expect(adaptResponse(response({ dataset_version: null }), request).datasetVersion).toBeNull();
  expect(() => adaptResponse(response({ dataset_version: 123 }), request)).toThrow(ContractError);
});
