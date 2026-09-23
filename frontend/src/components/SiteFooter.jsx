export default function SiteFooter({ copy, onNavigate }) {
  return <footer className="site-footer">
    <div className="footer-main">
      <div className="footer-brand"><button className="logo-button" type="button" onClick={() => onNavigate('home')}><span className="q-logo"><span>Q</span><i /></span><span className="wordmark">Help<span>Hunter</span></span></button><p>{copy.text}</p></div>
      <div><h3>{copy.product}</h3><button type="button" onClick={() => onNavigate('match')}>{copy.catalog}</button><button type="button" onClick={() => onNavigate('cart')}>{copy.estimate}</button></div>
      <div><h3>{copy.support}</h3><button type="button" onClick={() => { onNavigate('home'); setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }), 0); }}>{copy.how}</button><a href="https://github.com/BAITC-Hacks/hack-0edd372c-qlcd/blob/main/docs/frontend-integration.md" target="_blank" rel="noreferrer">{copy.api} ↗</a></div>
      <div className="footer-contact"><h3>Календарь каталога</h3><p>23.09.2026—31.12.2026</p><span>Доступность по данным каталога</span></div>
    </div>
    <div className="footer-bottom"><span>{copy.rights}</span><span>Built with love<b>●</b></span></div>
  </footer>;
}
