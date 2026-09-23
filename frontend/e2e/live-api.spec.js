import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { demoPresets } from '../src/data/demoPresets.js';

// Dataset audit is test-only. No catalog or calendars are shipped in the browser.
const bytes = readFileSync(new URL('../../backend/data/contractors.csv', import.meta.url));
const rows = parse(bytes, { columns: true, bom: true, skip_empty_lines: true });
const datasetVersion = createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
const split = text => text.split('|').map(value => value.trim()).filter(Boolean);
test.beforeAll(async ({ request }) => {
  const apiOrigin = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const health = await request.get(`${apiOrigin}/health`);
  expect(health.status()).toBe(200);
  expect((await health.json()).api_version, 'Restart backend: these regressions require API 1.2.0').toBe('1.2.0');
  const response = await request.get('/api/meta');
  expect(response.status()).toBe(200);
  const meta = await response.json();
  // Prevent a green run against a server that still runs the previous code/catalog.
  expect(meta.dataset_version, 'Restart backend: API must expose the current dataset version').toBe(datasetVersion);
  expect(meta.profile_count).toBe(rows.length);
  expect([...meta.cities].sort()).toEqual([...new Set(rows.map(row => row.city))].sort());
});
const expected = {
  A: { total: 10, eligible: 5 }, B: { total: 2, eligible: 2, ids: ['HK-39372', 'HK-90001'] },
  C: { total: 10, eligible: 0 }, D: { total: 0, eligible: 0 },
  E1: { total: 5, eligible: 3, ids: ['HK-80581', 'HK-37181', 'HK-97041'] },
  E2: { total: 5, eligible: 2, ids: ['HK-37181', 'HK-97041'] },
  F: { total: 7, eligible: 2, ids: ['HK-64395', 'HK-90011'] },
};
const normalized = value => value.replace(/\s+/g, ' ').trim();
function sourceEvidence(card) {
  return card.explanation.match(/Особенность из описания профиля: «([\s\S]+)»\.$/)?.[1];
}
function audit(raw) {
  expect(raw.dataset_version).toBe(datasetVersion);
  const q = raw.query;
  const group = rows.filter(row => row.city === q.city && split(row.categories).includes(q.category));
  const eligible = [];
  const reasons = {};
  for (const row of group) {
    const failure = [
      [split(row.busy_dates).includes(q.event_date), 'booked'],
      [Number(row.price_from_kzt) > q.budget_kzt, 'over_budget'],
      [!split(row.event_formats).includes(q.event_type), 'format'],
      [q.language && !split(row.languages).includes(q.language), 'language'],
      [q.duration_hours !== null && row.max_hours !== '' && Number(row.max_hours) < q.duration_hours, 'duration'],
    ].find(([failed]) => failed);
    if (failure) reasons[failure[1]] = (reasons[failure[1]] || 0) + 1;
    else eligible.push(row.id);
  }
  expect(raw.total_category_city).toBe(group.length);
  expect(raw.eligible_count).toBe(eligible.length);
  expect(raw.excluded_summary).toEqual(reasons);
  expect(raw.results.length).toBe(Math.min(3, eligible.length));
  expect(new Set(raw.results.map(card => card.id)).size).toBe(raw.results.length);
  for (const card of raw.results) {
    expect(eligible).toContain(card.id);
    const row = rows.find(row => row.id === card.id);
    expect(card.name).toBe(row.anon_name);
    expect(card.city).toBe(row.city);
    expect(card.category).toBe(q.category);
    expect(card.price_from_kzt).toBe(Number(row.price_from_kzt));
    expect(card.synthetic).toBe(row.synthetic === 'True');
    expect(card.city_imputed).toBe(row.city_imputed === 'True');
    expect(card.price_imputed).toBe(row.price_imputed === 'True');
    expect(card.explanation.trim().length).toBeGreaterThan(0);
    if (card.match_factors.includes('profile')) {
      const evidence = sourceEvidence(card);
      expect(evidence).toBeTruthy();
      expect(normalized(row.description)).toContain(normalized(evidence));
    }
  }
}
async function open(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать подбор →', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Подобрать', exact: true })).toBeEnabled();
}
async function preset(page, id) {
  if (!await page.getByLabel('Сценарий', { exact: true }).isVisible()) await page.getByText('Демо-сценарии', { exact: false }).click();
  await page.getByLabel('Сценарий', { exact: true }).selectOption(id);
  await page.getByRole('button', { name: 'Заполнить форму' }).click();
}
async function submit(page, enter = false) {
  const started = performance.now();
  const pending = page.waitForResponse(response => response.url().endsWith('/api/recommend') && response.request().method() === 'POST');
  if (enter) await page.getByLabel('Бюджет на одного подрядчика, ₸').press('Enter');
  else await page.getByRole('button', { name: 'Подобрать', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const raw = await response.json();
  const measuredMs = performance.now() - started;
  await response.finished();
  const timing = response.request().timing();
  const httpMs = timing.responseEnd - timing.requestStart;
  expect(httpMs).toBeGreaterThanOrEqual(0);
  expect(httpMs).toBeLessThan(10000);
  await expect(page.getByText('Результат последнего выполненного запроса')).toBeVisible();
  await expect(page.getByTestId('contractor-card')).toHaveCount(raw.results.length);
  return { raw, measuredMs, httpMs };
}

test('A–F use real backend, preserve order and satisfy CSV constraints', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.url().includes('/api/') && !response.ok()) errors.push(`HTTP ${response.status()}`); });
  await open(page);
  const report = { dataset_sha256: createHash('sha256').update(bytes).digest('hex'), project: testInfo.project.name, cases: [] };
  for (const item of demoPresets) {
    await preset(page, item.id);
    const { raw, measuredMs, httpMs } = await submit(page);
    audit(raw);
    const target = expected[item.id];
    expect(raw.total_category_city).toBe(target.total);
    expect(raw.eligible_count).toBe(target.eligible);
    if (target.ids) expect(raw.results.map(card => card.id).sort()).toEqual([...target.ids].sort());
    if (['B', 'E1', 'E2', 'F'].includes(item.id)) {
      const details = raw.results.map(card => {
        const evidence = sourceEvidence(card);
        expect(evidence).toBeTruthy();
        return normalized(evidence).toLowerCase().replaceAll(card.name.toLowerCase(), '');
      });
      expect(new Set(details).size).toBe(raw.results.length);
    }
    for (let i = 0; i < raw.results.length; i++) {
      await expect(page.getByTestId('contractor-card').nth(i)).toContainText(raw.results[i].name);
      await expect(page.getByTestId('contractor-card').nth(i)).toContainText(raw.results[i].explanation);
    }
    if (item.id === 'B') {
      await expect(page.getByText('Синтетический профиль', { exact: true })).toBeVisible();
      await expect(page.getByText(/Третьего варианта нет/)).toBeVisible();
      expect(rows.filter(row => target.ids.includes(row.id)).every(row => row.max_hours === '')).toBe(true);
    }
    if (item.id === 'C') await expect(page.getByRole('heading', { name: 'Никто не проходит все условия' })).toBeVisible();
    if (item.id === 'D') await expect(page.getByRole('heading', { name: 'Категории нет в каталоге города' })).toBeVisible();
    if (item.id === 'E2') {
      await expect(page.getByTestId('date-comparison')).toContainText('Состав выдачи изменился');
      await expect(page.getByTestId('date-comparison')).not.toContainText('Санджи');
      const removed = rows.find(row => row.id === 'HK-80581');
      expect(split(removed.busy_dates)).toContain('2026-10-16');
      expect(split(removed.busy_dates)).not.toContain('2026-10-15');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    report.cases.push({ id: item.id, interactionMs: measuredMs, httpMs, response: raw });
    if (item.id === 'A' || item.id === 'B') {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: testInfo.outputPath(`scenario-${item.id}.png`), fullPage: true, animations: 'disabled' });
    }
  }
  expect(errors).toEqual([]);
  const file = testInfo.outputPath('live-report.json');
  writeFileSync(file, JSON.stringify(report, null, 2));
  await testInfo.attach('live-api-report', { path: file, contentType: 'application/json' });
});

test('first load, edits, presets, repeat, Enter, reset and new browser context', async ({ page, context, browser }, testInfo) => {
  const posts = [];
  context.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/recommend')) posts.push(request); });
  await open(page);
  expect(posts).toHaveLength(0);
  await page.getByLabel('Город', { exact: true }).selectOption('Астана');
  await preset(page, 'A');
  expect(posts).toHaveLength(0);
  const first = await submit(page, true);
  const second = await submit(page);
  const third = await submit(page);
  expect(posts).toHaveLength(3);
  expect(first.raw).toEqual(second.raw);
  expect(second.raw).toEqual(third.raw);
  await page.getByLabel('Бюджет на одного подрядчика, ₸').fill('1000');
  await expect(page.getByText(/Условия изменены/)).toBeVisible();
  await expect(page.getByTestId('contractor-card')).toHaveCount(3);
  expect(posts).toHaveLength(3);
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(page.getByTestId('contractor-card')).toHaveCount(0);
  await expect(page.getByText('Начнём с ваших условий')).toBeVisible();
  const fresh = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const freshPage = await fresh.newPage();
  try { await open(freshPage); const fourth = await submit(freshPage); expect(fourth.raw).toEqual(first.raw); } finally { await fresh.close(); }
});

test('keyboard and invalid input prevent POST; connection loss stays technical', async ({ page, context }) => {
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST') posts++; });
  await open(page);
  await page.getByLabel('Бюджет на одного подрядчика, ₸').fill('0');
  await page.getByLabel('Бюджет на одного подрядчика, ₸').press('Enter');
  await expect(page.getByLabel('Бюджет на одного подрядчика, ₸')).toBeFocused();
  expect(posts).toBe(0);
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Подобрать', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Техническая ошибка');
  await expect(page.getByTestId('contractor-card')).toHaveCount(0);
  await context.setOffline(false);
  const pending = page.waitForResponse(response => response.url().endsWith('/api/recommend'));
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  expect((await pending).status()).toBe(200);
  await expect(page.getByTestId('contractor-card')).toHaveCount(3);
});

test('optional language, keyboard menu and local estimate/theme survive navigation and reload', async ({ page }, testInfo) => {
  await open(page);
  await page.getByLabel('Язык', { exact: true }).selectOption('');
  const noLanguage = await submit(page);
  expect(noLanguage.raw.query.language).toBeNull();
  await preset(page, 'B');
  const { raw } = await submit(page);
  const first = raw.results[0];
  await page.getByTestId('contractor-card').first().getByRole('button', { name: 'Добавить в смету +' }).click();
  await page.getByRole('button', { name: 'Смета: 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Смета мероприятия' })).toBeVisible();
  await expect(page.locator('.cart-item')).toContainText(first.id);
  const total = await page.locator('.cart-summary > strong').innerText();
  expect(Number(total.replace(/\D/g, ''))).toBe(first.price_from_kzt);

  const languageButton = page.getByRole('button', { name: 'Сменить язык' });
  await languageButton.focus();
  await languageButton.press('Enter');
  await expect(page.getByRole('group', { name: 'Язык интерфейса' })).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(languageButton).toBeFocused();
  await expect(page.getByRole('group', { name: 'Язык интерфейса' })).toHaveCount(0);

  const before = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Включить (тёмную|светлую) тему/ }).click();
  const changed = before === 'light' ? 'dark' : 'light';
  await expect(page.locator('html')).toHaveAttribute('data-theme', changed);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('estimate-theme.png'), fullPage: true, animations: 'disabled' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', changed);
  await page.getByRole('button', { name: 'Смета: 1', exact: true }).click();
  await expect(page.locator('.cart-item')).toContainText(first.id);
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Смета пока пуста' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Смета: 0', exact: true })).toBeVisible();
});

test('same-price live bands have distinct source-grounded explanations without names', async ({ page }) => {
  await open(page);
  await page.getByLabel('Категория подрядчика', { exact: true }).selectOption('Лайв-бэнд');
  await page.getByLabel('Дата мероприятия', { exact: true }).fill('2026-09-23');
  await page.getByLabel('Длительность, ч', { exact: true }).fill('');
  await page.getByLabel('Язык', { exact: true }).selectOption('');
  const { raw } = await submit(page);
  audit(raw);
  expect(new Set(raw.results.map(card => card.id))).toEqual(new Set(['HK-23752', 'HK-31819', 'HK-83709']));
  expect(new Set(raw.results.map(card => card.price_from_kzt)).size).toBe(1);
  const details = raw.results.map(card => normalized(sourceEvidence(card)).toLowerCase().replaceAll(card.name.toLowerCase(), ''));
  expect(new Set(details).size).toBe(3);
  for (const card of raw.results) await expect(page.getByTestId('contractor-card').filter({ hasText: card.id })).toContainText(sourceEvidence(card));
});
