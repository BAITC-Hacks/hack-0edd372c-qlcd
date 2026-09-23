import { MAX_DATE, MIN_DATE } from '../utils/validation';

const TEXT = {
  ru: { choose: 'Выберите значение', none: 'Не указан', title: 'Ваше мероприятие', description: 'Укажите условия — мы передадим их сервису подбора.', city: 'Город', date: 'Дата мероприятия', calendar: 'Календарь: 23 сентября — 31 декабря 2026', type: 'Тип мероприятия', category: 'Категория подрядчика', budget: 'Бюджет на одного подрядчика, ₸', budgetPlaceholder: 'Например, 500 000', budgetHint: 'Лимит на мероприятие, не почасовая ставка', optional: 'Дополнительные условия', optionalNote: 'необязательно', duration: 'Длительность, ч', durationPlaceholder: 'Не указана', language: 'Язык', loading: 'Подбираем…', submit: 'Подобрать' },
  kk: { choose: 'Мәнді таңдаңыз', none: 'Көрсетілмеген', title: 'Сіздің іс-шараңыз', description: 'Шарттарды көрсетіңіз — оларды іріктеу сервисіне жібереміз.', city: 'Қала', date: 'Іс-шара күні', calendar: 'Күнтізбе: 23 қыркүйек — 31 желтоқсан 2026', type: 'Іс-шара түрі', category: 'Мердігер санаты', budget: 'Бір мердігерге бюджет, ₸', budgetPlaceholder: 'Мысалы, 500 000', budgetHint: 'Сағаттық емес, іс-шараға арналған лимит', optional: 'Қосымша шарттар', optionalNote: 'міндетті емес', duration: 'Ұзақтығы, сағ', durationPlaceholder: 'Көрсетілмеген', language: 'Тіл', loading: 'Іріктелуде…', submit: 'Іріктеу' },
  en: { choose: 'Choose a value', none: 'Not specified', title: 'Your event', description: 'Set the requirements and we will send them to the matching service.', city: 'City', date: 'Event date', calendar: 'Calendar: September 23 — December 31, 2026', type: 'Event type', category: 'Contractor category', budget: 'Budget per contractor, ₸', budgetPlaceholder: 'For example, 500,000', budgetHint: 'Per-event limit, not an hourly rate', optional: 'Additional requirements', optionalNote: 'optional', duration: 'Duration, hours', durationPlaceholder: 'Not specified', language: 'Language', loading: 'Matching…', submit: 'Find matches' },
};

export default function SearchForm({ fields, metadata, errors, onChange, onSubmit, loading, language = 'ru' }) {
  const text = TEXT[language] || TEXT.ru;
  const displayOption = value => value ? value.slice(0, 1).toLocaleUpperCase(language) + value.slice(1) : value;

  function field(key, label, control, hint) {
    const shared = { id: key, name: key, value: fields[key], onChange: event => onChange(key, event.target.value), 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined };
    return <div className="field">
      <label htmlFor={key}>{label}</label>
      {control(shared)}
      {errors[key] ? <span id={`${key}-error`} className="field-error">{errors[key]}</span> : hint && <span className="hint" id={`${key}-hint`}>{hint}</span>}
    </div>;
  }

  const select = (key, label, options, optional = false) => field(key, label, props => <select {...props}>
    {(optional || !fields[key]) && <option value="">{optional ? text.none : text.choose}</option>}
    {options.map(value => <option value={value} key={value}>{displayOption(value)}</option>)}
  </select>);

  return <form onSubmit={onSubmit} noValidate aria-label="Параметры мероприятия">
    <div className="section-heading"><span className="step">01</span><h2>{text.title}</h2></div>
    <p className="section-description">{text.description}</p>
    <fieldset disabled={!metadata}>
      {select('city', text.city, metadata?.cities || [])}
      {field('date', text.date, props => <input {...props} type="date" min={MIN_DATE} max={MAX_DATE} />, text.calendar)}
      {select('eventType', text.type, metadata?.eventFormats || [])}
      {select('category', text.category, metadata?.categories || [])}
      {field('budget', text.budget, props => <input {...props} type="text" inputMode="numeric" autoComplete="off" placeholder={text.budgetPlaceholder} />, text.budgetHint)}
      <div className="optional-heading">{text.optional} <span>{text.optionalNote}</span></div>
      <div className="optional-grid">
        {field('duration', text.duration, props => <input {...props} type="text" inputMode="decimal" placeholder={text.durationPlaceholder} autoComplete="off" />)}
        {select('language', text.language, metadata?.languages || [], true)}
      </div>
      <button className="primary submit" type="submit" disabled={loading}>{loading ? text.loading : text.submit}<span aria-hidden="true">→</span></button>
    </fieldset>
  </form>;
}
