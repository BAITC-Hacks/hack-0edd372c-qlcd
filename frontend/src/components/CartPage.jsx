import { money } from '../utils/formatting';

export default function CartPage({ copy, items, onBrowse, onRemove, onClear, language = 'ru' }) {
  const total = items.reduce((sum, item) => sum + Number(item.price_from_kzt || 0), 0);
  const unit = language === 'en' ? (items.length === 1 ? 'contractor' : 'contractors') : language === 'kk' ? 'мердігер' : (items.length === 1 ? 'подрядчик' : 'подрядчика');
  return <main className="cart-page"><div className="cart-heading"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1></div>{items.length > 0 && <button className="secondary danger" type="button" onClick={onClear}>{copy.clear}</button>}</div>
    {items.length === 0 ? <div className="cart-empty"><div className="cart-empty-icon">Q</div><h2>{copy.emptyTitle}</h2><p>{copy.emptyText}</p><button className="primary" type="button" onClick={onBrowse}>{copy.browse} →</button></div> : <div className="cart-layout"><section className="cart-items">{items.map((item, index) => <article className="cart-item" key={item.id}><span className="rank">{String(index + 1).padStart(2, '0')}</span><div><small>{item.category} · {item.city}</small><h2>{item.name}</h2><p>{item.id}</p></div><strong>{money(item.price_from_kzt)} ₸</strong><button type="button" onClick={() => onRemove(item.id)}>{copy.remove}</button></article>)}</section><aside className="cart-summary"><p>{copy.total}</p><strong>{money(total)} ₸</strong><span>{items.length} {unit}</span><hr/><small>{copy.note}</small><button type="button" className="primary" onClick={onBrowse}>{copy.browse} →</button></aside></div>}
  </main>;
}
