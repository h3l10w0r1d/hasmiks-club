import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { getMe } from '../api/members'
import { useAuth } from '../context/AuthContext'
import GlobalHeader from '../components/GlobalHeader'

// Kept in sync with the same constants in RegisterForm.jsx / DashboardPage.jsx.
const JUST_REGISTERED_KEY = 'hc_just_registered'
const REGISTER_DRAFT_KEY = 'hc_register_draft'

/**
 * Lands here after Telegram's redirect-mode login widget round-trips through
 * GET /auth/telegram/callback on the backend, which already verified the
 * signed payload and appended either ?token=...(&new=1) or ?error=... to
 * this URL. There's no client-side Telegram callback anymore (see
 * TelegramLoginButton.jsx for why) — this page's only job is to finish
 * signing the member in and continue on to `next` (defaults to /dashboard;
 * GiftClaimPage passes its own claim page so it can apply the gift once
 * signed in).
 */
export default function TelegramAuthCompletePage({ lang = 'en' }) {
  const [searchParams] = useSearchParams()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const ran = useRef(false)

  const t = {
    signingIn: lang === 'hy' ? 'Մուտք գործում ենք…' : 'Signing you in…',
    failed: lang === 'hy' ? 'Telegram մուտքը ձախողվեց' : 'Telegram sign-in failed',
    back: lang === 'hy' ? '← Մուտք' : '← Back to login',
  }

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const token = searchParams.get('token')
    const next = searchParams.get('next') || '/dashboard'
    const errParam = searchParams.get('error')

    if (errParam || !token) {
      setError(t.failed)
      return
    }

    localStorage.setItem('hc_token', token)
    getMe()
      .then((user) => {
        if (searchParams.get('new') === '1') {
          try { sessionStorage.setItem(JUST_REGISTERED_KEY, '1') } catch { /* storage unavailable */ }
        }
        try { sessionStorage.removeItem(REGISTER_DRAFT_KEY) } catch { /* storage unavailable */ }
        signIn({ access_token: token, user })
        navigate(next, { replace: true })
      })
      .catch(() => {
        localStorage.removeItem('hc_token')
        setError(t.failed)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <GlobalHeader lang={lang} />
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">Hasmik's <span>Club</span></div>
          {error ? (
            <>
              <p className="auth-error">{error}</p>
              <Link to="/login" className="auth-link">{t.back}</Link>
            </>
          ) : (
            <p style={{ color: 'var(--taupe)' }}>{t.signingIn}</p>
          )}
        </div>
      </div>
    </>
  )
}
