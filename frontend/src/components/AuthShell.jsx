import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useContent } from '../context/SiteContentContext'
import { EditableImage } from './Editable'
import authBannerHy from '../assets/auth-banner-hy.jpg'
import authBannerEn from '../assets/auth-banner-en.jpg'

// Shared two-column popup-style shell for /login and /register — banner
// image on one side (swapped per language), tabs + the page's own form on
// the other. Still a dedicated route under GlobalHeader, not a true
// app-wide modal — the "close" button just goes home.
export default function AuthShell({ lang, active, children }) {
  const navigate = useNavigate()
  const hy = lang === 'hy'
  // Same shape as Hero's cover image: an admin override from the Site Editor,
  // falling back to the image bundled at build time when unset.
  const c = useContent().auth
  const banner = (hy ? c.bannerHy : c.bannerEn) || (hy ? authBannerHy : authBannerEn)
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
        <div className="auth-modal-banner">
          {/* Sizing is inline as well as in CSS on purpose. This app ships a
              service worker that precaches js/css (see vite.config.js), so a
              returning visitor can briefly get new JS with the previously
              cached stylesheet. When that happened, this <img> — which the
              old CSS knew nothing about — rendered at its natural 900x1600
              inside the 368px banner and got clipped to its top-left corner,
              which read as the artwork being wildly zoomed in. Inline styles
              ship in the same bundle as the markup that needs them, so they
              can never be out of step with it. */}
          <EditableImage
            src={banner}
            alt=""
            className="auth-modal-banner-img"
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            path={`auth.banner${hy ? 'Hy' : 'En'}`}
          />
        </div>
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
