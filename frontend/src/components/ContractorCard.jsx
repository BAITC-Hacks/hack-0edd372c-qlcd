import { money } from '../utils/formatting';

export default function ContractorCard({ card, position }) {
  return <article className="contractor-card" aria-label={`${position}. ${card.name}`} data-testid="contractor-card">
    <div className="card-heading">
      <span className="rank" aria-label={`Место ${position}`}>{String(position).padStart(2, '0')}</span>
      <div><p className="card-category">{card.category} · {card.city}</p><h3>{card.name}</h3></div>
      <span className="profile-id">{card.id}</span>
    </div>
    <div className="card-price">от {money(card.price_from_kzt)} ₸ <span>за мероприятие</span></div>
    <div className="explanation"><span className="explanation-label">Почему подходит</span><p>{card.explanation}</p></div>
    <div className="card-footer"><span className={`tag ${card.synthetic ? 'synthetic' : ''}`}>{card.synthetic ? 'Синтетический профиль' : 'Анонимизированный профиль'}</span></div>
    {card.price_imputed === true && <p className="data-note">Цена проставлена при подготовке датасета</p>}
    {card.city_imputed === true && <p className="data-note">Город проставлен при подготовке датасета</p>}
  </article>;
}
