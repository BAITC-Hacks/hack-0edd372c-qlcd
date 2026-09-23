import { useEffect, useRef, useState } from 'react';

const Icon = ({ name }) => name === 'sun'
  ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  : name === 'moon'
    ? <svg viewBox="0 0 24 24"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></svg>
    : name === 'globe'
      ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z"/></svg>
      : <svg viewBox="0 0 24 24"><path d="M4 7h16l-1.5 10h-13L4 7Zm3 0 1-3h8l1 3M9 20h.01M16 20h.01"/></svg>;

export default function SiteHeader({ page, copy, language, languageLabels, theme, cartCount, onNavigate, onLanguage, onTheme }) {
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const close = event => { if (!menuRef.current?.contains(event.target)) setLanguagesOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <header className="site-header"><div className="header-inner">
    <button className="logo-button" type="button" onClick={() => onNavigate('home')} aria-label="HelpHunter — главная"><span className="q-logo" aria-hidden="true"><span>Q</span><i /></span><span className="wordmark">Help<span>Hunter</span></span></button>
    <nav className="main-nav" aria-label="Основная навигация">{Object.entries(copy.nav).map(([key, label]) => <button type="button" className={page === key ? 'active' : ''} key={key} onClick={() => onNavigate(key)}>{label}</button>)}</nav>
    <div className="header-tools"><div className="language-menu" ref={menuRef}>
      <button className="icon-button language-button" type="button" aria-label="Сменить язык" aria-expanded={languagesOpen} onClick={() => setLanguagesOpen(value => !value)}><Icon name="globe"/><span>{languageLabels[language]}</span></button>
      {languagesOpen && <div className="language-popover" role="menu">{Object.entries(languageLabels).map(([code, label]) => <button role="menuitem" className={language === code ? 'selected' : ''} type="button" key={code} onClick={() => { onLanguage(code); setLanguagesOpen(false); }}>{label}<span>{code === 'ru' ? 'Русский' : code === 'kk' ? 'Қазақша' : 'English'}</span></button>)}</div>}
    </div>
    <button className="icon-button" type="button" aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'} onClick={onTheme}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button>
    <button className="cart-button" type="button" onClick={() => onNavigate('cart')} aria-label={`${copy.nav.cart}: ${cartCount}`}><Icon name="cart"/><span className="cart-label">{copy.nav.cart}</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
    <button className="header-cta" type="button" aria-label={copy.headerAction} onClick={() => onNavigate('match')}>{copy.headerAction}<span aria-hidden="true">↗</span></button>
    </div>
  </div></header>;
}
