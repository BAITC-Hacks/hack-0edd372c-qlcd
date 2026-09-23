import { describe, expect, it } from 'vitest';
import { initialFields } from '../data/demoPresets';
import { serializeRequest, validDate } from '../utils/validation';
import { displayDate } from '../utils/formatting';

describe('request serialization', () => {
  it('maps actual backend names and optional nulls', () => {
    const { request, errors } = serializeRequest({ ...initialFields, budget: '1 500 000', duration: '', language: '' });
    expect(errors).toEqual({});
    expect(request).toEqual({ city: 'Алматы', event_date: '2026-10-10', event_type: 'корпоратив', category: 'Ведущий', budget_kzt: 1500000, duration_hours: null, language: null, limit: 3 });
  });
  it.each(['', '0', '-1', '1.2', 'abc', 'Infinity', 'NaN', '9007199254740992', '1 23', '1e6'])('rejects invalid budget %s according to gt=0', budget => {
    expect(serializeRequest({ ...initialFields, budget }).errors.budget).toBeTruthy();
  });
  it.each(['0', '-1', 'Infinity', 'NaN', 'hello', '1,2,3', '1e500'])('rejects invalid duration %s', duration => {
    expect(serializeRequest({ ...initialFields, duration }).errors.duration).toBeTruthy();
  });
  it('accepts fractional hours, zero optional language and grouped nonbreaking spaces', () => {
    expect(serializeRequest({ ...initialFields, duration: '6,5', budget: '500\u202f000' }).request.duration_hours).toBe(6.5);
  });
  it.each(['2026-09-23', '2026-12-31'])('accepts calendar boundary %s unchanged', date => {
    expect(serializeRequest({ ...initialFields, date }).request.event_date).toBe(date);
  });
  it.each(['2026-09-22', '2027-01-01', '2026-11-31', '2026-02-29', '', '2026-10-10T00:00:00Z'])('rejects invalid date %s', date => {
    expect(serializeRequest({ ...initialFields, date }).errors.date).toBeTruthy();
  });
  it('formats without timezone conversion', () => {
    expect(displayDate('2026-10-10')).toBe('10.10.2026');
    expect(validDate('2024-02-29')).toBe(true);
    expect(validDate('2026-13-01')).toBe(false);
  });
});
