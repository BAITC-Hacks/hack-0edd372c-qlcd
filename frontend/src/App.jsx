import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { initialFields } from './data/demoPresets';
import { serializeRequest } from './utils/validation';
import { storedCart, storedChoice, storeValue } from './utils/storage';
import { useRecommendations } from './hooks/useRecommendations';
import SearchForm from './components/SearchForm';
import DemoPresets from './components/DemoPresets';
import ResultsPanel from './components/ResultsPanel';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import HomePage from './components/HomePage';
import CartPage from './components/CartPage';

const LANGUAGE_LABELS = { ru: 'RU', kk: 'KZ', en: 'EN' };
const COPY = {
  ru: {
    nav: { home: 'Главная', match: 'Подрядчики', cart: 'Смета' }, headerAction: 'Найти подрядчика',
    matcher: { eyebrow: 'Точный подбор без лишнего шума', title: 'Подрядчики под ваше событие', subtitle: 'До трёх подходящих вариантов с понятным объяснением выбора' },
    home: { badge: 'Сервис подбора подрядчиков', titleA: 'Соберите сильную команду', titleB: 'для вашего события', lead: 'HelpHunter сравнивает условия, бюджет и доступность — и показывает подходящих специалистов без бесконечного поиска.', primary: 'Начать подбор', secondary: 'Как это работает', trust: '66 профилей в каталоге', speed: 'Подбор за секунды', explain: 'Прозрачный результат', panelTitle: 'Ваше событие', panelCity: 'Алматы', panelType: 'Корпоратив', sectionEyebrow: 'Простой процесс', sectionTitle: 'От идеи до готовой команды', steps: [['01', 'Опишите событие', 'Укажите город, дату, формат и комфортный бюджет.'], ['02', 'Получите подборку', 'Алгоритм проверит каталог и объяснит каждый результат.'], ['03', 'Соберите смету', 'Добавьте специалистов в список и оцените стартовый бюджет.']], categoriesTitle: 'Всё для события — в одном месте', categoriesText: 'Ведущие, декораторы, фотографы и другие специалисты из единого каталога.' },
    cart: { eyebrow: 'Ваша команда', title: 'Смета мероприятия', emptyTitle: 'Смета пока пуста', emptyText: 'Перейдите к подбору и добавьте подходящих подрядчиков.', browse: 'Перейти к подбору', total: 'Стартовая стоимость', note: 'Итоговая цена и доступность подтверждаются напрямую с подрядчиком.', clear: 'Очистить смету', remove: 'Удалить' },
    footer: { text: 'Умный подбор подрядчиков для мероприятий.', product: 'Продукт', support: 'Помощь', catalog: 'Подбор подрядчиков', estimate: 'Смета', how: 'Как это работает', api: 'API документация', rights: '© 2026 HelpHunter. Проект команды HackAlem.' },
  },
  kk: {
    nav: { home: 'Басты бет', match: 'Іріктеу', cart: 'Смета' }, headerAction: 'Мердігер табу',
    matcher: { eyebrow: 'Артық іздеусіз дәл іріктеу', title: 'Іс-шараңызға арналған мердігерлер', subtitle: 'Таңдау себебі түсіндірілген үшке дейін лайықты нұсқа' },
    home: { badge: 'Мердігерлерді іріктеу сервисі', titleA: 'Іс-шараңызға мықты команда', titleB: 'жинаңыз', lead: 'HelpHunter талаптарды, бюджетті және қолжетімділікті салыстырып, лайықты мамандарды ұсынады.', primary: 'Іріктеуді бастау', secondary: 'Қалай жұмыс істейді', trust: 'Каталогта 66 профиль', speed: 'Бірнеше секундта', explain: 'Түсінікті нәтиже', panelTitle: 'Сіздің іс-шараңыз', panelCity: 'Алматы', panelType: 'Корпоратив', sectionEyebrow: 'Қарапайым процесс', sectionTitle: 'Идеядан дайын командаға дейін', steps: [['01', 'Іс-шараны сипаттаңыз', 'Қаланы, күнді, форматты және бюджетті көрсетіңіз.'], ['02', 'Ұсыныстарды алыңыз', 'Алгоритм каталогты тексеріп, әр нәтижені түсіндіреді.'], ['03', 'Смета жасаңыз', 'Мамандарды қосып, бастапқы бюджетті есептеңіз.']], categoriesTitle: 'Іс-шараға қажеттінің бәрі бір жерде', categoriesText: 'Жүргізушілер, декораторлар, фотографтар және басқа мамандар.' },
    cart: { eyebrow: 'Сіздің командаңыз', title: 'Іс-шара сметасы', emptyTitle: 'Смета әзірге бос', emptyText: 'Іріктеуге өтіп, лайықты мердігерлерді қосыңыз.', browse: 'Іріктеуге өту', total: 'Бастапқы құны', note: 'Соңғы баға мен қолжетімділік мердігермен тікелей расталады.', clear: 'Сметаны тазалау', remove: 'Жою' },
    footer: { text: 'Іс-шара мердігерлерін ақылды іріктеу.', product: 'Өнім', support: 'Көмек', catalog: 'Мердігерлерді іріктеу', estimate: 'Смета', how: 'Қалай жұмыс істейді', api: 'API құжаттамасы', rights: '© 2026 HelpHunter. HackAlem командасының жобасы.' },
  },
  en: {
    nav: { home: 'Home', match: 'Find talent', cart: 'Estimate' }, headerAction: 'Find a contractor',
    matcher: { eyebrow: 'Precise matching, less noise', title: 'Contractors for your event', subtitle: 'Up to three suitable options with a clear explanation' },
    home: { badge: 'Contractor matching service', titleA: 'Build a remarkable team', titleB: 'for your event', lead: 'HelpHunter compares requirements, budget and availability to surface the right specialists without endless searching.', primary: 'Start matching', secondary: 'How it works', trust: '66 catalog profiles', speed: 'Results in seconds', explain: 'Transparent results', panelTitle: 'Your event', panelCity: 'Almaty', panelType: 'Corporate event', sectionEyebrow: 'A simple process', sectionTitle: 'From an idea to a ready team', steps: [['01', 'Describe the event', 'Set the city, date, format and your comfortable budget.'], ['02', 'Get your shortlist', 'The algorithm checks the catalog and explains every result.'], ['03', 'Build an estimate', 'Add specialists and review the starting project total.']], categoriesTitle: 'Everything for an event, in one place', categoriesText: 'Hosts, decorators, photographers and other specialists in a single catalog.' },
    cart: { eyebrow: 'Your team', title: 'Event estimate', emptyTitle: 'Your estimate is empty', emptyText: 'Open the matcher and add contractors that fit your event.', browse: 'Find contractors', total: 'Starting total', note: 'Final pricing and availability are confirmed directly with each contractor.', clear: 'Clear estimate', remove: 'Remove' },
    footer: { text: 'Smart contractor matching for memorable events.', product: 'Product', support: 'Support', catalog: 'Contractor matcher', estimate: 'Estimate', how: 'How it works', api: 'API documentation', rights: '© 2026 HelpHunter. A HackAlem team project.' },
  },
};

export default function App({ client = api }) {
  const [page, setPage] = useState('home');
  const [language, setLanguage] = useState(() => storedChoice('helphunter-language', Object.keys(COPY), 'ru'));
  const [theme, setTheme] = useState(() => storedChoice('helphunter-theme', ['light', 'dark'], window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [cart, setCart] = useState(storedCart);
  const [fields, setFields] = useState({ ...initialFields });
  const [errors, setErrors] = useState({}); const [metadata, setMetadata] = useState(null); const [metaError, setMetaError] = useState(null); const [metaAttempt, setMetaAttempt] = useState(0); const [announcement, setAnnouncement] = useState('');
  const { state, submit, reset } = useRecommendations(client); const copy = COPY[language] || COPY.ru;
  useEffect(() => { document.documentElement.dataset.theme = theme; storeValue('helphunter-theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.lang = language; storeValue('helphunter-language', language); }, [language]);
  useEffect(() => { storeValue('helphunter-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { const controller = new AbortController(); let active = true; client.metadata({ signal: controller.signal }).then(value => { if (active) { setMetadata(value); setMetaError(null); } }).catch(error => { if (active && error.name !== 'AbortError') setMetaError('Не удалось загрузить справочники. Проверьте подключение к API.'); }); return () => { active = false; controller.abort(); }; }, [client, metaAttempt]);
  const current = serializeRequest(fields, metadata).request; const dirty = Boolean(state.request && JSON.stringify(current) !== JSON.stringify(state.request)); const serverErrors = state.phase === 'error' && !dirty ? state.error.fieldErrors || {} : {}; const cartIds = useMemo(() => new Set(cart.map(item => item.id)), [cart]);
  useEffect(() => { if (state.phase === 'error') { const firstField = Object.keys(state.error.fieldErrors || {})[0]; if (firstField) document.getElementById(firstField)?.focus(); } }, [state]);
  function navigate(next) { setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function onSubmit(event) { event?.preventDefault(); if (!metadata || state.phase === 'loading') return; const result = serializeRequest(fields, metadata); setErrors(result.errors); if (!result.request) { document.getElementById(Object.keys(result.errors)[0])?.focus(); return; } setAnnouncement(''); submit(result.request); }
  function onReset() { reset(); setFields({ ...initialFields }); setErrors({}); setAnnouncement('Форма и результаты сброшены.'); }
  function loadPreset(values) { setFields({ ...values }); setErrors({}); setAnnouncement('Сценарий загружен. Нажмите «Подобрать».'); }
  function addToCart(card) { setCart(items => items.some(item => item.id === card.id) ? items : [...items, card]); }
  return <div className="site-shell">
    <SiteHeader page={page} copy={copy} language={language} languageLabels={LANGUAGE_LABELS} theme={theme} cartCount={cart.length} onNavigate={navigate} onLanguage={setLanguage} onTheme={() => setTheme(value => value === 'light' ? 'dark' : 'light')} />
    {page === 'home' && <HomePage copy={copy.home} language={language} onNavigate={navigate} />}
    {page === 'match' && <main className="matcher-main"><div className="hero matcher-hero"><p className="eyebrow">{copy.matcher.eyebrow}</p><h1>{copy.matcher.title}</h1><p className="subtitle">{copy.matcher.subtitle}</p></div><div className="workspace"><aside className="form-column"><div className="form-panel">
      {!metadata && !metaError && <p role="status" className="hint">Загружаем справочники…</p>}{metaError && <div role="alert" className="error-panel"><p>{metaError}</p><button className="secondary" type="button" onClick={() => setMetaAttempt(value => value + 1)}>Загрузить справочники</button></div>}
      {metadata?.notice && <p className="metadata-note" role="status">{metadata.notice}</p>}
      <SearchForm language={language} fields={fields} metadata={metadata} errors={{ ...serverErrors, ...errors }} loading={state.phase === 'loading'} onChange={(key, value) => { setFields(now => ({ ...now, [key]: value })); setErrors(now => ({ ...now, [key]: undefined })); }} onSubmit={onSubmit} /><button className="reset" type="button" onClick={onReset}>Сбросить</button></div>
      <DemoPresets onLoad={loadPreset} disabled={!metadata || state.phase === 'loading'} /><p role="status" className="hint announcement">{announcement}</p>
    </aside><ResultsPanel language={language} state={state} dirty={dirty} onRetry={() => onSubmit()} onAddToCart={addToCart} cartIds={cartIds} onOpenCart={() => navigate('cart')} /></div></main>}
    {page === 'cart' && <CartPage copy={copy.cart} language={language} items={cart} onBrowse={() => navigate('match')} onRemove={id => setCart(items => items.filter(item => item.id !== id))} onClear={() => setCart([])} />}
    <SiteFooter copy={copy.footer} onNavigate={navigate} />
  </div>;
}
