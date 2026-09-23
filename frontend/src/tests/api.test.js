import { afterEach, expect, it, vi } from 'vitest';
import { createApi, normalizeBase } from '../api';
import { request, response } from './fixtures';

afterEach(() => vi.useRealTimers());
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
it('calls actual /api/recommend path once, without duplicate prefix', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(json(response()));
  await createApi({ baseUrl: '/api///', fetchImpl }).recommend(request);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][0]).toBe('/api/recommend');
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(request);
  expect(normalizeBase('https://example.org/api/')).toBe('https://example.org/api');
});
it.each([
  [() => json({ detail: [{ loc: ['body', 'budget_kzt'], type: 'greater_than', msg: 'secret raw message' }] }, 422), 'validation'],
  [() => json({}, 500), 'server'], [() => json({}, 404), 'route'], [() => json({}, 405), 'route'],
  [() => new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } }), 'content'],
  [() => new Response('{', { headers: { 'content-type': 'application/json' } }), 'json'],
])('reports HTTP/protocol failures separately', async (makeResponse, code) => {
  const client = createApi({ fetchImpl: vi.fn().mockResolvedValue(makeResponse()) });
  await expect(client.recommend(request)).rejects.toMatchObject({ code });
});
it('maps 422 errors to form fields without exposing raw details', async () => {
  const client = createApi({ fetchImpl: vi.fn().mockResolvedValue(json({ detail: [{ loc: ['body', 'budget_kzt'], type: 'greater_than', input: 'secret', msg: 'secret' }] }, 422)) });
  await expect(client.recommend(request)).rejects.toMatchObject({ fieldErrors: { budget: 'Значение должно быть больше нуля.' } });
});
it('network failure does not create results', async () => {
  await expect(createApi({ fetchImpl: vi.fn().mockRejectedValue(new TypeError('secret upstream')) }).recommend(request)).rejects.toMatchObject({ code: 'network' });
});
it('times out, aborts fetch and clears timers', async () => {
  vi.useFakeTimers();
  let signal;
  const fetchImpl = vi.fn((_url, options) => { signal = options.signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))); });
  const result = createApi({ fetchImpl, timeoutMs: 100 }).recommend(request);
  const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(101);
  await assertion;
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it('external cancellation is not a service outage', async () => {
  const controller = new AbortController();
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))));
  const pending = createApi({ fetchImpl }).recommend(request, { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
it('unknown schema stays a contract error', async () => {
  await expect(createApi({ fetchImpl: vi.fn().mockResolvedValue(json({ results: [] })) }).recommend(request)).rejects.toMatchObject({ name: 'ContractError' });
});

it('an invalid absolute API address is reported as a configuration error', async () => {
  const fetchImpl = vi.fn();
  await expect(createApi({ baseUrl: 'http://[invalid', fetchImpl }).recommend(request)).rejects.toMatchObject({ code: 'configuration' });
  expect(fetchImpl).not.toHaveBeenCalled();
});
