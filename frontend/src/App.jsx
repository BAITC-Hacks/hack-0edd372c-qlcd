import { useEffect, useState } from 'react';
import { api } from './api';
import { initialFields } from './data/demoPresets';
import { serializeRequest } from './utils/validation';
import { useRecommendations } from './hooks/useRecommendations';
import SearchForm from './components/SearchForm';
import DemoPresets from './components/DemoPresets';
import ResultsPanel from './components/ResultsPanel';

export default function App({ client = api }) {
  const [fields, setFields] = useState({ ...initialFields });
  const [errors, setErrors] = useState({});
  const [metadata, setMetadata] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [metaAttempt, setMetaAttempt] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const { state, submit, reset } = useRecommendations(client);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    client.metadata({ signal: controller.signal }).then(value => { if (active) { setMetadata(value); setMetaError(null); } }).catch(error => {
      if (active && error.name !== 'AbortError') setMetaError('Не удалось загрузить справочники. Проверьте подключение к API.');
    });
    return () => { active = false; controller.abort(); };
  }, [client, metaAttempt]);
  const current = serializeRequest(fields, metadata).request;
  const dirty = Boolean(state.request && JSON.stringify(current) !== JSON.stringify(state.request));
  const serverErrors = state.phase === 'error' && !dirty ? state.error.fieldErrors || {} : {};
  useEffect(() => {
    if (state.phase === 'error') {
      const firstField = Object.keys(state.error.fieldErrors || {})[0];
      if (firstField) document.getElementById(firstField)?.focus();
    }
  }, [state]);
  function onSubmit(event) {
    event.preventDefault();
    if (!metadata || state.phase === 'loading') return;
    const result = serializeRequest(fields, metadata);
    setErrors(result.errors);
    if (!result.request) { document.getElementById(Object.keys(result.errors)[0])?.focus(); return; }
    setAnnouncement('');
    submit(result.request);
  }
  function onReset() { reset(); setFields({ ...initialFields }); setErrors({}); setAnnouncement('Форма и результаты сброшены.'); }
  function loadPreset(values) { setFields({ ...values }); setErrors({}); setAnnouncement('Сценарий загружен. Нажмите «Подобрать».'); }
  return <>
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true">h.</span><span>HackAlem<span className="brand-divider"> / </span><span className="brand-context">Подбор подрядчиков</span></span></div><span className="header-label">Каталог мероприятий</span></header>
    <main>
      <div className="hero"><p className="eyebrow">Меньше поиска. Больше ясности.</p><h1>Умный подбор подрядчиков</h1><p className="subtitle">До трёх вариантов с объяснением выбора</p></div>
      <div className="workspace"><aside className="form-column">
        <div className="form-panel">
          {!metadata && !metaError && <p role="status" className="hint">Загружаем справочники…</p>}
          {metaError && <div role="alert" className="error-panel"><p>{metaError}</p><button className="secondary" type="button" onClick={() => setMetaAttempt(value => value + 1)}>Загрузить справочники</button></div>}
          <SearchForm fields={fields} metadata={metadata} errors={{ ...serverErrors, ...errors }} loading={state.phase === 'loading'} onChange={(key, value) => { setFields(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); }} onSubmit={onSubmit} />
          <button className="reset" type="button" onClick={onReset}>Сбросить</button>
        </div>
        <DemoPresets onLoad={loadPreset} disabled={!metadata || state.phase === 'loading'} />
        <p role="status" className="hint announcement">{announcement}</p>
        {metadata?.notice && <details className="metadata-note"><summary>О справочнике городов</summary><p>{metadata.notice}</p><p className="hint">Источник: {metadata.source.source}<br />SHA-256: <code>{metadata.source.sha256}</code></p></details>}
      </aside><ResultsPanel state={state} dirty={dirty} onRetry={() => submit(state.request)} /></div>
    </main>
    <footer className="page-footer"><span>HackAlem · 2026</span><span>Подбор из каталога · 23.09–31.12.2026</span></footer>
  </>;
}
