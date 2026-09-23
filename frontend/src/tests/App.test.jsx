import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import App from '../App';
import { adaptMetadata, adaptResponse } from '../adapters';
import { ApiError } from '../api';
import { compareRequests } from '../hooks/useRecommendations';
import { deferred, meta, request, response } from './fixtures';

function client() {
  return { source: '/api', metadata: vi.fn().mockResolvedValue(adaptMetadata(meta)), recommend: vi.fn().mockResolvedValue(adaptResponse(response(), request)) };
}
async function mount(service = client()) {
  render(<App client={service} />);
  await userEvent.click(screen.getByRole('button', { name: 'Найти подрядчика' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Подобрать' })).toBeEnabled());
  return service;
}
async function send() { await userEvent.click(screen.getByRole('button', { name: 'Подобрать' })); }
it('does not POST on load or editing, submits all fields on click', async () => {
  const service = await mount();
  expect(service.recommend).not.toHaveBeenCalled();
  await userEvent.selectOptions(screen.getByLabelText('Город'), 'Астана');
  expect(service.recommend).not.toHaveBeenCalled();
  await send();
  expect(service.recommend).toHaveBeenCalledTimes(1);
  expect(service.recommend.mock.calls[0][0]).toEqual({ ...request, city: 'Астана' });
});
it('Enter sends the form and renders full explanation, summary and provenance', async () => {
  const service = await mount();
  await userEvent.type(screen.getByLabelText('Бюджет на одного подрядчика, ₸'), '{Enter}');
  expect(service.recommend).toHaveBeenCalledTimes(1);
  expect(await screen.findByTestId('contractor-card')).toHaveTextContent(response().results[0].explanation);
  expect(screen.getByText('Анонимизированный профиль')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Подобрано 1' })).toBeVisible();
  expect(screen.getByText(/Меньше трёх вариантов/)).toBeVisible();
});
it('invalid fields focus the first error and prevent calling API', async () => {
  const service = await mount();
  await userEvent.clear(screen.getByLabelText('Бюджет на одного подрядчика, ₸'));
  await send();
  expect(service.recommend).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Бюджет на одного подрядчика, ₸')).toHaveFocus();
  expect(screen.getByText(/Введите целое/)).toBeVisible();
});
it('draft values do not relabel previously submitted results; presets do not POST', async () => {
  const service = await mount(); await send();
  await userEvent.click(screen.getByText('Демо-сценарии'));
  await userEvent.selectOptions(screen.getByLabelText('Сценарий'), 'B');
  await userEvent.click(screen.getByRole('button', { name: 'Заполнить форму' }));
  expect(service.recommend).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Условия изменены/)).toBeVisible();
  expect(screen.getByText('Алматы · 10.10.2026 · корпоратив · Ведущий')).toBeVisible();
});
it('reset prevents late responses and clears errors/history', async () => {
  const service = client(), late = deferred(); service.recommend.mockReturnValue(late.promise);
  await mount(service); await send();
  expect(screen.getByRole('button', { name: 'Подбираем…' })).toBeDisabled();
  const signal = service.recommend.mock.calls[0][1].signal;
  await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
  expect(signal.aborted).toBe(true);
  await act(async () => late.resolve(adaptResponse(response(), request)));
  expect(screen.queryByTestId('contractor-card')).not.toBeInTheDocument();
  expect(screen.getByText('Начнём с ваших условий')).toBeVisible();
});
it('a late old response cannot replace a newer response', async () => {
  const service = client(), late = deferred(); service.recommend.mockReturnValueOnce(late.promise);
  await mount(service); await send();
  await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
  await send();
  expect(await screen.findByTestId('contractor-card')).toBeVisible();
  await act(async () => late.resolve({ ...adaptResponse(response(), request), cards: [] }));
  expect(screen.getAllByTestId('contractor-card')).toHaveLength(1);
});
it('technical errors remove previous cards and retry issues a new request', async () => {
  const service = await mount(); await send();
  service.recommend.mockRejectedValueOnce(new ApiError('server', 'Техническая ошибка сервиса.'));
  await send();
  expect(await screen.findByRole('alert')).toHaveTextContent('Техническая ошибка');
  expect(screen.queryByTestId('contractor-card')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(service.recommend).toHaveBeenCalledTimes(3);
  expect(await screen.findByTestId('contractor-card')).toBeVisible();
});
it.each([
  ['no_category_in_city', 0, {}, 'Категории нет в каталоге города'],
  ['no_candidates_meet_conditions', 2, { over_budget: 2 }, 'Никто не проходит все условия'],
])('shows %s as business outcome, not technical error', async (status, total, excluded, title) => {
  const service = client();
  service.recommend.mockResolvedValue(adaptResponse(response({ status, total_category_city: total, eligible_count: 0, excluded_summary: excluded, results: [] }), request));
  await mount(service); await send();
  expect(await screen.findByRole('heading', { name: title })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('shows only confirmed synthetic and imputed flags and escaped explanation', async () => {
  const raw = response(); Object.assign(raw.results[0], { synthetic: true, city_imputed: true, price_imputed: true, explanation: '<script>not executable</script>' });
  const service = client(); service.recommend.mockResolvedValue(adaptResponse(raw, request));
  await mount(service); await send();
  expect(await screen.findByText('Синтетический профиль')).toBeVisible();
  expect(screen.getByText('Цена проставлена при подготовке датасета')).toBeVisible();
  expect(screen.getByText('Город проставлен при подготовке датасета')).toBeVisible();
  expect(screen.getByText('<script>not executable</script>')).toBeVisible();
  expect(document.querySelector('script')).toBeNull();
});
it('has honest first-failure statistics and preserves the raw API message', async () => {
  await mount(); await send();
  await userEvent.click(screen.getByText('Как выполнен подбор'));
  expect(screen.getByText('Каждый профиль учитывается один раз — по первой причине исключения.')).toBeVisible();
  expect(screen.getByText('Заняты на выбранную дату')).toBeVisible();
  await userEvent.click(screen.getByText('Технические детали API'));
  expect(screen.getByText('Подходит один профиль.')).toBeVisible();
});
it('comparison never assigns a personal reason and resets for other changes/version', () => {
  const previous = { request, source: '/api', response: adaptResponse(response(), request) };
  const next = { ...previous, request: { ...request, event_date: '2026-10-11' }, response: { ...previous.response, cards: [] } };
  expect(compareRequests(previous, next)).toContain('Состав выдачи изменился');
  expect(compareRequests(previous, next)).not.toContain('TEST-1');
  expect(compareRequests(previous, { ...next, request: { ...next.request, budget_kzt: 1 } })).toBeNull();
  expect(compareRequests(previous, { ...next, response: { ...next.response, datasetVersion: 'new' } })).toBeNull();
  expect(compareRequests(previous, { ...next, source: 'another' })).toBeNull();
});
it('an unavailable metadata service cannot enable a fake fallback', async () => {
  const service = client(); service.metadata.mockRejectedValue(new Error('secret'));
  render(<App client={service} />);
  await userEvent.click(screen.getByRole('button', { name: 'Найти подрядчика' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить справочники');
  fireEvent.submit(screen.getByRole('form'));
  expect(service.recommend).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Подобрать' })).toBeDisabled();
});

it('discloses legacy city metadata fallback while recommendations still come from the API', async () => {
  const service = client();
  const legacyMetadata = adaptMetadata({ ...meta, cities: ['А', 'л', 'м'] });
  service.metadata.mockResolvedValue(legacyMetadata);
  await mount(service);
  expect(screen.getByText(legacyMetadata.notice)).toBeVisible();
  expect(screen.getByRole('option', { name: 'Алматы' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'А', exact: true })).not.toBeInTheDocument();
  expect(service.recommend).not.toHaveBeenCalled();
  await send();
  expect(service.recommend).toHaveBeenCalledTimes(1);
  expect(await screen.findByTestId('contractor-card')).toHaveTextContent('Тестовый ведущий');
});

it('uses valid API cities without a fallback notice or additional local cities', async () => {
  await mount();
  expect(screen.queryByText(/Список городов взят из CSV/)).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Астана' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Зарубежье' })).not.toBeInTheDocument();
});

it('can remove an optional language restriction after selecting a language', async () => {
  const service = await mount();
  await userEvent.selectOptions(screen.getByLabelText('Язык'), 'казахский');
  await userEvent.selectOptions(screen.getByLabelText('Язык'), '');
  await send();
  expect(service.recommend.mock.calls[0][0].language).toBeNull();
});

it('retry validates and sends the currently edited form after an API error', async () => {
  const service = client();
  service.recommend.mockRejectedValueOnce(new ApiError('server', 'Временная ошибка.'));
  await mount(service); await send();
  await screen.findByRole('alert');
  const budget = screen.getByLabelText('Бюджет на одного подрядчика, ₸');
  await userEvent.clear(budget);
  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(service.recommend).toHaveBeenCalledTimes(1);
  expect(budget).toHaveFocus();
  await userEvent.type(budget, '500000');
  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(service.recommend.mock.calls[1][0].budget_kzt).toBe(500000);
});

it('unavailable browser storage cannot break matching or the current estimate', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await mount(); await send();
  await userEvent.click(await screen.findByRole('button', { name: 'Добавить в смету +' }));
  await userEvent.click(screen.getByRole('button', { name: 'Смета: 1' }));
  expect(screen.getByRole('heading', { name: 'Смета мероприятия' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Тестовый ведущий' })).toBeVisible();
});

it('invalid saved preferences and estimate recover to a usable form', async () => {
  localStorage.setItem('helphunter-language', 'not a locale');
  localStorage.setItem('helphunter-theme', 'invalid');
  localStorage.setItem('helphunter-cart', '{"id":"not-an-array"}');
  await mount(); await send();
  expect(await screen.findByTestId('contractor-card')).toBeVisible();
  expect(document.documentElement.lang).toBe('ru');
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(screen.getByRole('button', { name: 'Смета: 0' })).toBeVisible();
});

it('language choices support Tab and Escape, returning focus to the trigger', async () => {
  await mount();
  const trigger = screen.getByRole('button', { name: 'Сменить язык' });
  await userEvent.click(trigger);
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'RU Русский' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(trigger);
  await userEvent.click(screen.getByRole('button', { name: 'EN English' }));
  expect(trigger).toHaveFocus();
  expect(document.documentElement.lang).toBe('en');
  expect(screen.getByRole('heading', { name: 'Contractors for your event' })).toBeVisible();
});
