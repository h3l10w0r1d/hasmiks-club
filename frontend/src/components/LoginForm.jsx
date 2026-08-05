import { useState } from 'react'
import { Link } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import GoogleSignInButton from './GoogleSignInButton'
import TelegramLoginButton from './TelegramLoginButton'

// The actual sign-in form body — shared by LoginPage (a real route, for
// direct links/bookmarks/SEO) and AuthModal (the popup). `onSuccess` lets
// each caller decide what happens next: LoginPage navigates, AuthModal just
// closes itself and leaves the visitor on whatever page they were already on.
export default function LoginForm({ lang, onSuccess, onSwitchToRegister, showForgotLink = true }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const t = {
    title:    lang === 'hy' ? 'Մուտք գործել' : 'Sign In',
    email:    lang === 'hy' ? 'Էլ. հասցե' : 'Email',
    password: lang === 'hy' ? 'Գաղտնաբառ' : 'Password',
    submit:   lang === 'hy' ? 'Մուտք' : 'Sign In',
    noAcc:    lang === 'hy' ? 'Հաշիվ չունե՞ք։' : "Don't have an account?",
    register: lang === 'hy' ? 'Գրանցվել' : 'Join the Circle',
    errDef:   lang === 'hy' ? 'Սխալ էլ. հասցե կամ գաղտնաբառ' : 'Invalid email or password',
    forgot:   lang === 'hy' ? 'Մոռացե՞լ եք գաղտնաբառը' : 'Forgot password?',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      signIn(data)
      onSuccess(data)
    } catch {
      setError(t.errDef)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="auth-title">{t.title}</h1>
      <div className="auth-divider" />
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-label">{t.email}
          <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label className="auth-label">{t.password}
          <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn-rose auth-submit" type="submit" disabled={loading}>
          {loading ? '...' : t.submit}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--sand)' }} />
        <span style={{ fontSize: 12, color: 'var(--stone)' }}>{lang === 'hy' ? 'կամ' : 'or'}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--sand)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <GoogleSignInButton lang={lang}
          onSuccess={(data) => { signIn(data); onSuccess(data) }}
          onError={setError} />
        <TelegramLoginButton />
      </div>

      <p className="auth-footer">
        {t.noAcc}{' '}
        {onSwitchToRegister
          ? <button type="button" className="auth-link auth-link-btn" onClick={onSwitchToRegister}>{t.register}</button>
          : <Link to="/register" className="auth-link">{t.register}</Link>}
      </p>
      {showForgotLink && (
        <p className="auth-footer">
          <Link to="/forgot-password" className="auth-link">{t.forgot}</Link>
        </p>
      )}
    </>
  )
}
