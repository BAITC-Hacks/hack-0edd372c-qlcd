import { MAX_DATE, MIN_DATE } from '../utils/validation';

export default function SearchForm({ fields, metadata, errors, onChange, onSubmit, loading }) {
  function field(key, label, control, hint) {
    const shared = { id: key, name: key, value: fields[key], onChange: event => onChange(key, event.target.value), 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined };
    return <div className="field">
      <label htmlFor={key}>{label}</label>
      {control(shared)}
      {errors[key] ? <span id={`${key}-error`} className="field-error">{errors[key]}</span> : hint && <span className="hint" id={`${key}-hint`}>{hint}</span>}
    </div>;
  }
  const select = (key, label, options, optional = false) => field(key, label, props => <select {...props}>
    <option value="">{optional ? 'Не указан' : 'Выберите значение'}</option>
    {options.map(value => <option value={value} key={value}>{value}</option>)}
  </select>);
  return <form onSubmit={onSubmit} noValidate aria-label="Параметры мероприятия">
    <div className="section-heading"><span className="step">01</span><h2>Ваше мероприятие</h2></div>
    <p className="section-description">Укажите условия — мы передадим их сервису подбора.</p>
    <fieldset disabled={!metadata}>
      {select('city', 'Город', metadata?.cities || [])}
      {field('date', 'Дата мероприятия', props => <input {...props} type="date" min={MIN_DATE} max={MAX_DATE} />, 'Календарь: 23 сентября — 31 декабря 2026')}
      {select('eventType', 'Тип мероприятия', metadata?.eventFormats || [])}
      {select('category', 'Категория подрядчика', metadata?.categories || [])}
      {field('budget', 'Бюджет на одного подрядчика, ₸', props => <input {...props} type="text" inputMode="numeric" autoComplete="off" placeholder="Например, 500 000" />, 'Лимит на мероприятие, не почасовая ставка')}
      <div className="optional-heading">Дополнительные условия <span>необязательно</span></div>
      <div className="optional-grid">
        {field('duration', 'Длительность, ч', props => <input {...props} type="text" inputMode="decimal" placeholder="Не указана" autoComplete="off" />)}
        {select('language', 'Язык', metadata?.languages || [], true)}
      </div>
      <button className="primary submit" type="submit" disabled={loading}>{loading ? 'Подбираем…' : 'Подобрать'}<span aria-hidden="true">→</span></button>
    </fieldset>
  </form>;
}
