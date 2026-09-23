export default function HomePage({ copy, language, onNavigate }) {
  const categories = language === 'en'
    ? ['Hosts', 'Photo & video', 'Decor', 'Catering', 'Music']
    : language === 'kk'
      ? ['Жүргізушілер', 'Фото және видео', 'Декор', 'Кейтеринг', 'Музыка']
      : ['Ведущие', 'Фото & видео', 'Декор', 'Кейтеринг', 'Музыка'];
  return <main className="home-page">
    <section className="home-hero">
      <div className="home-copy"><p className="hero-badge"><span>●</span>{copy.badge}</p><h1>{copy.titleA}<br/><em>{copy.titleB}</em></h1><p className="home-lead">{copy.lead}</p><div className="hero-actions"><button type="button" className="primary hero-primary" onClick={() => onNavigate('match')}>{copy.primary}<span>→</span></button><button type="button" className="text-button" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>{copy.secondary}<span>↓</span></button></div><div className="trust-row"><span>✓ {copy.trust}</span><span>✓ {copy.speed}</span><span>✓ {copy.explain}</span></div></div>
      <div className="hero-visual" aria-label={copy.panelTitle}><div className="orange-orbit orbit-one"/><div className="orange-orbit orbit-two"/><div className="event-card"><div className="event-card-head"><span className="mini-q">Q</span><div><small>{copy.panelTitle}</small><strong>{copy.panelType}</strong></div><span className="status-dot">{copy.panelStatus}</span></div><div className="event-meta"><span><small>01</small>{copy.panelCity}</span><span><small>02</small>18.10.2026</span></div><div className="match-preview"><div className="avatar-stack"><i>АК</i><i>МС</i><i>+1</i></div><div><strong>{copy.panelResult}</strong><span>98% · 94% · 91%</span></div><b>→</b></div></div><div className="floating-chip chip-one">✓ 66</div><div className="floating-chip chip-two">₸</div></div>
    </section>
    <section className="process-section" id="how-it-works"><p className="eyebrow">{copy.sectionEyebrow}</p><h2>{copy.sectionTitle}</h2><div className="process-grid">{copy.steps.map(([number, title, text]) => <article key={number}><span>{number}</span><div className="step-icon">{number === '01' ? '⌁' : number === '02' ? '◎' : '✓'}</div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="category-banner"><div><p className="eyebrow">HelpHunter</p><h2>{copy.categoriesTitle}</h2><p>{copy.categoriesText}</p></div><div className="category-pills">{categories.map(value => <span key={value}>{value}</span>)}<span>+ 12</span></div><button type="button" onClick={() => onNavigate('match')} aria-label={copy.primary}>→</button></section>
  </main>;
}
