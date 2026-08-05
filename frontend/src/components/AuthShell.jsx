import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import authBannerHy from '../assets/auth-banner-hy.jpg'
import authBannerEn from '../assets/auth-banner-en.jpg'

// Shared two-column popup-style shell for /login and /register — banner
// image on one side (swapped per language), tabs + the page's own form on
// the other. Still a dedicated route under GlobalHeader, not a true
// app-wide modal — the "close" button just goes home.
export default function AuthShell({ lang, active, children }) {
  const navigate = useNavigate()
  const banner = lang === 'hy' ? authBannerHy : authBannerEn
  const t = {
    login: lang === 'hy' ? 'Մուտք' : 'Log in',
    register: lang === 'hy' ? 'Գրանցվել' : 'Sign up',
  }

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <button type="button" className="auth-modal-close" aria-label="Close" onClick={() => navigate('/')}>
          <X size={18} />
        </button>
        <div className="auth-modal-banner" style={{ backgroundImage: `url(${banner})` }} aria-hidden="true" />
        <div className="auth-modal-body">
          <div className="auth-tabs">
            <Link to="/login" className={`auth-tab${active === 'login' ? ' auth-tab-active' : ''}`}>{t.login}</Link>
            <Link to="/register" className={`auth-tab${active === 'register' ? ' auth-tab-active' : ''}`}>{t.register}</Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
