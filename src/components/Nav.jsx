import t from '../data/content'

export default function Nav({ lang, setLang }) {
  return (
    <nav>
      <div className="nav-logo">Hasmik's <span>Club</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="lang-toggle">
          <button
            className={`lang-btn${lang === 'en' ? ' active' : ''}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
          <button
            className={`lang-btn${lang === 'hy' ? ' active' : ''}`}
            onClick={() => setLang('hy')}
          >
            ՀԱՅ
          </button>
        </div>
        <a href="#pricing" className="nav-btn">
          {lang === 'en' ? t.nav.joinEn : t.nav.joinHy}
        </a>
      </div>
    </nav>
  )
}
