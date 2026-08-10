import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useContent } from '../context/SiteContentContext'
import authBannerHy from '../assets/auth-banner-hy.jpg'
import authBannerEn from '../assets/auth-banner-en.jpg'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'

// The real popup — a fixed overlay on top of whatever page is currently
// showing, mounted once at the app root by AuthModalProvider. Same visual
// shell (banner/tabs) as AuthShell, but tabs switch mode in place instead of
// navigating, and it closes on Escape or a backdrop click.
export default function AuthModal({ lang, mode, onModeChange, onClose }) {
  const navigate = useNavigate()
  // Reads the same Site Editor override as AuthShell — the popup and the
  // /login,/register routes always show the same artwork. Not an
  // EditableImage here: the editor previews the routes, not this overlay.
  const c = useContent().auth
  const banner = (lang === 'hy' ? c.bannerHy : c.bannerEn) || (lang === 'hy' ? authBannerHy : authBannerEn)
  const t = {
    login: lang === 'hy' ? 'Մուտք' : 'Log in',
    register: lang === 'hy' ? 'Գրանցվել' : 'Sign up',
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="auth-modal-overlay auth-modal-overlay--fixed"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="auth-modal">
        <button type="button" className="auth-modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="auth-modal-banner" style={{ backgroundImage: `url(${banner})` }} aria-hidden="true" />
        <div className="auth-modal-body">
          <div className="auth-tabs">
            <button type="button" className={`auth-tab${mode === 'login' ? ' auth-tab-active' : ''}`} onClick={() => onModeChange('login')}>{t.login}</button>
            <button type="button" className={`auth-tab${mode === 'register' ? ' auth-tab-active' : ''}`} onClick={() => onModeChange('register')}>{t.register}</button>
          </div>
          {mode === 'login' ? (
            <LoginForm lang={lang} onSuccess={onClose} onSwitchToRegister={() => onModeChange('register')} />
          ) : (
            <RegisterForm lang={lang} onSuccess={() => { onClose(); navigate('/dashboard') }} onSwitchToLogin={() => onModeChange('login')} />
          )}
        </div>
      </div>
    </div>
  )
}
