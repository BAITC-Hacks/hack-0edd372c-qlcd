import ContractorCard from './ContractorCard';
import SelectionTrace from './SelectionTrace';
import { displayDate, elapsed, money } from '../utils/formatting';
import { ApiError } from '../api';
import { ContractError } from '../adapters';

function Snapshot({ request }) {
  return <div className="snapshot">
    <p className="eyebrow">Результат последнего выполненного запроса</p>
    <p>{request.city} · {displayDate(request.event_date)} · {request.event_type} · {request.category}</p>
    <p className="muted">До {money(request.budget_kzt)} ₸{request.duration_hours !== null ? ` · ${request.duration_hours} ч` : ''}{request.language ? ` · ${request.language}` : ''}</p>
  </div>;
}
export default function ResultsPanel({ state, dirty, onRetry }) {
  const { phase, request, response } = state;
  return <section className="results" aria-labelledby="results-title" aria-busy={phase === 'loading'}>
    <div className="section-heading"><span className="step">02</span><h2 id="results-title">Подходящие варианты</h2>{phase === 'done' && <span className="time">{elapsed(state.elapsedMs)}</span>}</div>
    <div aria-live="polite" aria-atomic="true" className="sr-only">{phase === 'loading' ? 'Запрос выполняется' : phase === 'done' ? `Подбор завершён. Показано: ${response.cards.length}` : ''}</div>
    {phase === 'idle' && <div className="empty-state initial-state"><div className="empty-symbol" aria-hidden="true">↗</div><h3>Начнём с ваших условий</h3><p>Заполните форму и нажмите «Подобрать». Здесь появятся до трёх вариантов с объяснением выбора.</p><div className="empty-steps"><span>Дата и город</span><span>Бюджет и формат</span><span>Объяснение выбора</span></div></div>}
    {phase === 'loading' && <div className="empty-state"><span className="spinner" aria-hidden="true" /><h3>Проверяем условия</h3><p>Ожидаем ответ сервиса подбора.</p></div>}
    {phase === 'error' && <div className="error-panel" role="alert"><h3>Техническая ошибка</h3><p>{state.error instanceof ApiError || state.error instanceof ContractError ? state.error.message : 'Не удалось выполнить запрос. Повторите попытку.'}</p><button type="button" className="secondary" onClick={onRetry}>Повторить</button><p className="hint">Время ожидания: {elapsed(state.elapsedMs)}</p></div>}
    {phase === 'done' && <>
      <Snapshot request={request} />
      {dirty && <p className="draft-notice">Условия изменены. Показан предыдущий результат — нажмите «Подобрать», чтобы применить изменения.</p>}
      {state.comparison && <p className="comparison" data-testid="date-comparison">{state.comparison}</p>}
      {response.status === 'matches_found' && <>
        <div className="result-summary"><h3>Подобрано {response.cards.length}</h3><p>{response.summary}</p><p>{response.trace.eligible > 3 ? `Показаны 3 из ${response.trace.eligible} подходящих. Остальные прошли условия, но не вошли в тройку.` : `В каталоге для этого города и категории: ${response.trace.total}. Подходят: ${response.trace.eligible}.`}</p>
          {response.cards.length < 3 && <p>{response.trace.total < 3 && response.trace.total === response.trace.eligible ? (response.trace.total === 1 ? 'Других вариантов нет: в каталоге только один профиль этой категории в городе.' : 'Третьего варианта нет: в каталоге всего два профиля этой категории в городе.') : `Меньше трёх вариантов: всего профилей ${response.trace.total}, исключено по условиям ${response.trace.total - response.trace.eligible}.`}</p>}
        </div>
        <div className="card-list">{response.cards.map((card, index) => <ContractorCard key={card.id} card={card} position={index + 1} />)}</div>
        <p className="disclaimer">Указаны стартовые цены. Итоговая стоимость и фактическая доступность отдельно не подтверждались.</p>
      </>}
      {response.status === 'category_not_found' && <div className="empty-state compact"><h3>Категории нет в каталоге города</h3><p>В текущем каталоге для города «{request.city}» нет категории «{request.category}».</p><p className="hint">Можно изменить город или категорию в форме.</p></div>}
      {response.status === 'no_eligible_candidates' && <div className="empty-state compact"><h3>Никто не проходит все условия</h3><p>Подрядчики этой категории в городе есть, но никто не проходит все условия.</p><p>Исходных профилей: {response.trace.total}. Причины исключения приведены ниже.</p></div>}
      <SelectionTrace response={response} />
    </>}
  </section>;
}
