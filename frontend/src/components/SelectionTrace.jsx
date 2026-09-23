import { rejectionLabels } from '../adapters';

export default function SelectionTrace({ response }) {
  const { trace, cards, summary } = response;
  return <details className="trace-panel">
    <summary>Как выполнен подбор</summary>
    <div className="trace-content">
      <dl className="trace-totals">
        <div><dt>В городе и категории</dt><dd>{trace.total}</dd></div>
        <div><dt>Прошли условия</dt><dd>{trace.eligible}</dd></div>
        <div><dt>Показано</dt><dd>{cards.length}</dd></div>
      </dl>
      <p>Исключено профилей: <strong>{trace.total - trace.eligible}</strong></p>
      <ul className="rejections">
        {Object.entries(rejectionLabels).filter(([key]) => Object.hasOwn(trace.rejected, key)).map(([key, label]) => <li key={key}><span>{label}</span><strong>{trace.rejected[key]}</strong></li>)}
      </ul>
      <p className="hint">Каждый профиль учитывается один раз — по первой причине исключения.</p>
      <p className="hint">Порядок проверок: дата → бюджет → формат → язык → длительность.</p>
      <details className="technical-details"><summary>Технические детали API</summary>{response.status !== 'matches_found' && <p>{summary}</p>}<p className="hint">Версия каталога: {response.datasetVersion || 'API не сообщает'}. Подставленные при подготовке датасета цена и город отмечаются в карточках, если API передал соответствующие признаки.</p></details>
    </div>
  </details>;
}
