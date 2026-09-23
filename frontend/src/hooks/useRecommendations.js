import { useCallback, useEffect, useRef, useState } from 'react';
import { displayDate } from '../utils/formatting';

export function compareRequests(previous, current) {
  if (!previous || previous.source !== current.source || previous.response.datasetVersion !== current.response.datasetVersion) return null;
  const { event_date: beforeDate, ...before } = previous.request;
  const { event_date: afterDate, ...after } = current.request;
  if (JSON.stringify(before) !== JSON.stringify(after) || beforeDate === afterDate) return null;
  const oldIds = previous.response.cards.map(card => card.id);
  const newIds = current.response.cards.map(card => card.id);
  const changed = oldIds.length !== newIds.length || oldIds.some(id => !newIds.includes(id));
  // Only aggregate first-failure data is available; never assign reasons to IDs.
  const booked = current.response.trace.rejected.booked;
  return `Дата изменена: ${displayDate(beforeDate)} → ${displayDate(afterDate)}. Состав выдачи ${changed ? 'изменился' : 'не изменился'}.${booked !== undefined ? ` По данным API, из-за занятости исключено: ${booked}.` : ''} Причины для отдельных профилей API не сообщает.`;
}

export function useRecommendations(client) {
  const [state, setState] = useState({ phase: 'idle' });
  const sequence = useRef(0);
  const pending = useRef(null);
  const previous = useRef(null);
  const cancel = useCallback(() => { sequence.current += 1; pending.current?.abort(); pending.current = null; }, []);
  const reset = useCallback(() => { cancel(); previous.current = null; setState({ phase: 'idle' }); }, [cancel]);
  useEffect(() => () => cancel(), [cancel, client]);
  const submit = useCallback(async request => {
    cancel();
    const token = sequence.current;
    const controller = new AbortController();
    pending.current = controller;
    const started = performance.now();
    setState({ phase: 'loading', request });
    try {
      const response = await client.recommend(request, { signal: controller.signal });
      if (token !== sequence.current) return;
      const completed = { phase: 'done', request, response, elapsedMs: performance.now() - started, source: client.source };
      completed.comparison = compareRequests(previous.current, completed);
      previous.current = completed;
      setState(completed);
    } catch (error) {
      if (token !== sequence.current) return;
      previous.current = null;
      setState({ phase: 'error', request, error, elapsedMs: performance.now() - started });
    } finally {
      if (token === sequence.current) pending.current = null;
    }
  }, [cancel, client]);
  return { state, submit, reset };
}
