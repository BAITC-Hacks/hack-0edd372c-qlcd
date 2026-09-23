import { adaptMetadata, adaptResponse } from './adapters';

export class ApiError extends Error {
  constructor(code, message, fieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
export function normalizeBase(value) {
  const base = value.trim().replace(/\/+$/, '');
  if (!base || (!base.startsWith('/') && !/^https?:\/\//.test(base)) || base.startsWith('//') || /[?#]/.test(base)) throw new ApiError('configuration', 'Неверно настроен адрес API.');
  if (/^https?:/.test(base)) {
    const url = new URL(base);
    if (url.username || url.password) throw new ApiError('configuration', 'Адрес API не должен содержать учётные данные.');
  }
  return base;
}

const fieldNames = { city: 'city', event_date: 'date', event_type: 'eventType', category: 'category', budget_kzt: 'budget', duration_hours: 'duration', language: 'language' };
export function validationErrors(detail) {
  const errors = {};
  if (Array.isArray(detail)) {
    for (const item of detail) {
      const field = Array.isArray(item.loc) ? fieldNames[item.loc.at(-1)] : undefined;
      if (field) errors[field] = item.type === 'greater_than' ? 'Значение должно быть больше нуля.' : 'API отклонил это значение. Проверьте поле.';
    }
  } else if (typeof detail === 'string' && detail.startsWith('event_date must be between')) {
    errors.date = 'API принимает даты с 23.09.2026 по 31.12.2026.';
  }
  return errors;
}

export function createApi({ baseUrl = import.meta.env.VITE_API_URL || '/api', timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 10000), fetchImpl = (...args) => fetch(...args) } = {}) {
  let base;
  // Configuration errors flow through the ordinary UI error state, not module import.
  const source = baseUrl;
  async function json(path, { signal, body } = {}) {
    base = normalizeBase(baseUrl);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new ApiError('configuration', 'Неверно настроено время ожидания API.');
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await fetchImpl(`${base}/${path}`, {
        method: body ? 'POST' : 'GET', signal: controller.signal,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status >= 500) throw new ApiError('server', 'Техническая ошибка сервиса. Повторите запрос позже.');
      if ([404, 405].includes(response.status)) throw new ApiError('route', 'Маршрут или метод API недоступен. Проверьте настройку подключения.');
      if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiError('content', 'API вернул не JSON. Проверьте адрес и настройку прокси.');
      let raw;
      try { raw = await response.json(); } catch (error) {
        if (controller.signal.aborted) throw error;
        throw new ApiError('json', 'API вернул повреждённый JSON.');
      }
      if (response.status === 422) throw new ApiError('validation', 'API отклонил параметры запроса. Проверьте отмеченные поля.', validationErrors(raw?.detail));
      if (!response.ok) throw new ApiError('http', `Техническая ошибка HTTP ${response.status}.`);
      return raw;
    } catch (error) {
      if (timedOut) throw new ApiError('timeout', `Время ожидания API истекло (${timeoutMs / 1000} с). Сервер может продолжать обработку.`);
      if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');
      if (error instanceof ApiError) throw error;
      throw new ApiError('network', 'Сервис недоступен. Проверьте подключение и запуск backend.');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  return {
    source,
    async metadata(options) { return adaptMetadata(await json('meta', options)); },
    async recommend(request, options) { return adaptResponse(await json('recommend', { ...options, body: request }), request); },
  };
}
export const api = createApi();
