import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * GlobalHeader — used on every page except the dashboard and admin panel,
 * which have their own dedicated navigation.
 *
 * Props (all optional):
 *   lang      string   'en' | 'hy'  — current language
 *   setLang   fn       setter — shows language toggle when provided
 */
export default function GlobalHeader({ lang = 'en', setLang }) {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const isActive = (path) => pathname === path

  const t = {
    en: {
      home:      'Home',
      events:    'Events',
      signIn:    'Sign In',
      join:      'Join the Circle',
      dashboard: 'My Account',
      admin:     'Admin',
    },
    hy: {
      home:      'Գլխավոր',
      events:    'Հանդիպումներ',
      signIn:    'Մուտք',
      join:      'Անդամ դառնալ',
      dashboard: 'Իմ հաշիվը',
      admin:     'Ադմին',
    },
  }[lang] ?? {
    home: 'Home', events: 'Events', signIn: 'Sign In',
    join: 'Join the Circle', dashboard: 'My Account', admin: 'Admin',
  }

  return (
    <header className="gh">
      {/* ── brand ─────────────────────────────────────── */}
      <Link to="/" className="gh-brand">
        <img src="/logo-h.png" alt="" className="gh-logo" aria-hidden="true" />
        <span className="gh-brand-text">Hasmik's <span>Club</span></span>
      </Link>

      {/* ── centre nav links ──────────────────────────── */}
      <div className="gh-links" role="navigation" aria-label="Site navigation">
        <Link to="/"       className={`gh-link${isActive('/')       ? ' gh-link--active' : ''}`}>{t.home}</Link>
        <Link to="/events" className={`gh-link${isActive('/events') ? ' gh-link--active' : ''}`}>{t.events}</Link>
      </div>

      {/* ── right side ────────────────────────────────── */}
      <div className="gh-right">
        {/* language toggle — only when parent provides setLang */}
        {setLang && (
          <div className="gh-lang">
            <button
              className={`gh-lang-btn${lang === 'en' ? ' active' : ''}`}
              onClick={() => setLang('en')}
            >EN</button>
            <button
              className={`gh-lang-btn${lang === 'hy' ? ' active' : ''}`}
              onClick={() => setLang('hy')}
            >ՀԱՅ</button>
          </div>
        )}

        {user ? (
          <div className="gh-auth">
            {user.is_admin && (
              <Link to="/admin" className="gh-btn gh-btn--ghost">{t.admin}</Link>
            )}
            <Link to="/dashboard" className="gh-btn gh-btn--outline">{t.dashboard}</Link>
          </div>
        ) : (
          <div className="gh-auth">
            <Link
              to="/login"
              state={pathname !== '/login' ? { from: pathname } : undefined}
              className="gh-btn gh-btn--ghost"
            >{t.signIn}</Link>
            <Link to="/register" className="gh-btn gh-btn--solid">{t.join}</Link>
          </div>
        )}
      </div>
    </header>
  )
}
