import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import GlobalHeader from '../components/GlobalHeader'

export default function LoginPage({ lang }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/dashboard'
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
      navigate(from, { replace: true })
    } catch {
      setError(t.errDef)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <GlobalHeader lang={lang} />
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Hasmik's <span>Club</span></div>
        <span className="auth-logo-sub">{lang === 'hy' ? 'Անդամների հարթակ' : 'Members Portal'}</span>
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
        <p className="auth-footer">
          {t.noAcc} <Link to="/register" className="auth-link">{t.register}</Link>
        </p>
        <p className="auth-footer">
          <Link to="/forgot-password" className="auth-link">{t.forgot}</Link>
        </p>
      </div>
    </div>
    </>
  )
}
