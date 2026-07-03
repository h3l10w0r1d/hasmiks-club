import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const isActive = (path) => pathname === path
  const close = () => setMenuOpen(false)

  // close the mobile menu whenever the route changes
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // give the header a subtle shadow once the page has scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const t = {
    en: {
      home: 'Home', events: 'Events', about: 'About', contact: 'Contact',
      signIn: 'Sign In', join: 'Join the Circle', dashboard: 'My Account', admin: 'Admin',
    },
    hy: {
      home: 'Գլխավոր', events: 'Հանդիպումներ', about: 'Մեր մասին', contact: 'Կապ',
      signIn: 'Մուտք', join: 'Անդամ դառնալ', dashboard: 'Իմ հաշիվը', admin: 'Ադմին',
    },
  }[lang] ?? {
    home: 'Home', events: 'Events', about: 'About', contact: 'Contact', signIn: 'Sign In',
    join: 'Join the Circle', dashboard: 'My Account', admin: 'Admin',
  }

  const navLinks = (
    <>
      <Link to="/"        className={`gh-link${isActive('/')        ? ' gh-link--active' : ''}`} onClick={close}>{t.home}</Link>
      <Link to="/events"  className={`gh-link${isActive('/events')  ? ' gh-link--active' : ''}`} onClick={close}>{t.events}</Link>
      <Link to="/about"   className={`gh-link${isActive('/about')   ? ' gh-link--active' : ''}`} onClick={close}>{t.about}</Link>
      <Link to="/contact" className={`gh-link${isActive('/contact') ? ' gh-link--active' : ''}`} onClick={close}>{t.contact}</Link>
    </>
  )

  const authLinks = user ? (
    <>
      {user.is_admin && <Link to="/admin" className="gh-btn gh-btn--ghost" onClick={close}>{t.admin}</Link>}
      <Link to="/dashboard" className="gh-btn gh-btn--outline" onClick={close}>{t.dashboard}</Link>
    </>
  ) : (
    <>
      <Link to="/login" state={pathname !== '/login' ? { from: pathname } : undefined} className="gh-btn gh-btn--ghost" onClick={close}>{t.signIn}</Link>
      <Link to="/register" className="gh-btn gh-btn--solid" onClick={close}>{t.join}</Link>
    </>
  )

  const langToggle = setLang && (
    <div className="gh-lang">
      <button className={`gh-lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => setLang('en')}>EN</button>
      <button className={`gh-lang-btn${lang === 'hy' ? ' active' : ''}`} onClick={() => setLang('hy')}>ՀԱՅ</button>
    </div>
  )

  return (
    <header className={`gh${scrolled ? ' gh--scrolled' : ''}`}>
      {/* ── brand ─────────────────────────────────────── */}
      <Link to="/" className="gh-brand" onClick={close}>
        <img src="/logo-h.png" alt="" className="gh-logo" aria-hidden="true" />
        <span className="gh-brand-text">Hasmik's <span>Club</span></span>
      </Link>

      {/* ── centre nav (desktop) ──────────────────────── */}
      <div className="gh-links" role="navigation" aria-label="Site navigation">
        {navLinks}
      </div>

      {/* ── right side ────────────────────────────────── */}
      <div className="gh-right">
        {langToggle}
        <div className="gh-auth">{authLinks}</div>
        <button
          className="gh-burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── mobile dropdown ───────────────────────────── */}
      {menuOpen && (
        <div className="gh-mobile">
          <nav className="gh-mobile-nav">{navLinks}</nav>
          <div className="gh-mobile-auth">{authLinks}</div>
        </div>
      )}
    </header>
  )
}
