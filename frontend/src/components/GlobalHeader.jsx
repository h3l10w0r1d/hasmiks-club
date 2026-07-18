import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useContent } from '../context/SiteContentContext'
import { E, EditableImage } from './Editable'
import LangSwitch from './LangSwitch'

/**
 * GlobalHeader — used on every page except the dashboard and admin panel,
 * which have their own dedicated navigation.
 *
 * Props (all optional):
 *   lang      string   'en' | 'hy'  — current language
 *   setLang   fn       setter — shows language toggle when provided
 */
export default function GlobalHeader({ lang = 'hy', setLang }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const site = useContent()
  const nav = site.nav
  const sfx = lang === 'hy' ? 'Hy' : 'En'

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

  // internal app labels (dashboard/admin) — not marketing content, stay fixed
  const t = { hy: { dashboard: 'Իմ հաշիվը', admin: 'Ադմին' }, en: { dashboard: 'My Account', admin: 'Admin' } }[lang]
    ?? { dashboard: 'My Account', admin: 'Admin' }

  const navLinks = (
    <>
      <Link to="/"        className={`gh-link${isActive('/')        ? ' gh-link--active' : ''}`} onClick={close}><E as="span" path={`nav.home${sfx}`} value={nav[`home${sfx}`]} /></Link>
      <Link to="/events"  className={`gh-link${isActive('/events')  ? ' gh-link--active' : ''}`} onClick={close}><E as="span" path={`nav.events${sfx}`} value={nav[`events${sfx}`]} /></Link>
      <Link to="/about"   className={`gh-link${isActive('/about')   ? ' gh-link--active' : ''}`} onClick={close}><E as="span" path={`nav.about${sfx}`} value={nav[`about${sfx}`]} /></Link>
      <Link to="/contact" className={`gh-link${isActive('/contact') ? ' gh-link--active' : ''}`} onClick={close}><E as="span" path={`nav.contact${sfx}`} value={nav[`contact${sfx}`]} /></Link>
    </>
  )

  const authLinks = user ? (
    <>
      {user.is_admin && <Link to="/admin" className="gh-btn gh-btn--ghost" onClick={close}>{t.admin}</Link>}
      <Link to="/dashboard" className="gh-btn gh-btn--outline" onClick={close}>{t.dashboard}</Link>
    </>
  ) : (
    <>
      <Link to="/login" state={pathname !== '/login' ? { from: pathname } : undefined} className="gh-btn gh-btn--ghost" onClick={close}><E as="span" path={`nav.signIn${sfx}`} value={nav[`signIn${sfx}`]} /></Link>
      <Link to="/register" className="gh-btn gh-btn--solid" onClick={close}><E as="span" path={`nav.join${sfx}`} value={nav[`join${sfx}`]} /></Link>
    </>
  )

  const langToggle = <LangSwitch lang={lang} setLang={setLang} />

  return (
    <header className={`gh${scrolled ? ' gh--scrolled' : ''}`}>
      {/* ── brand ─────────────────────────────────────── */}
      <Link to="/" className="gh-brand" onClick={close}>
        <EditableImage src={nav.logo || '/logo-h.png'} alt="" className="gh-logo" path="nav.logo" />
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
