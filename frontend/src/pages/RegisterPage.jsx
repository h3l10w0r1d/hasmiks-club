import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage({ lang }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', lang_pref: lang || 'en' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const t = {
    title:    lang === 'hy' ? 'Միանալ համայնքին' : 'Join the Circle',
    name:     lang === 'hy' ? 'Անուն Ազգանուն' : 'Full Name',
    email:    lang === 'hy' ? 'Էլ. հասցե' : 'Email',
    password: lang === 'hy' ? 'Գաղտնաբառ' : 'Password',
    submit:   lang === 'hy' ? 'Գրանցվել' : 'Create Account',
    hasAcc:   lang === 'hy' ? 'Արդեն հաշիվ ունե՞ք։' : 'Already have an account?',
    login:    lang === 'hy' ? 'Մուտք գործել' : 'Sign In',
    errDef:   lang === 'hy' ? 'Գրանցման սխալ' : 'Registration failed. Try again.',
    errEmail: lang === 'hy' ? 'Այս էլ. հասցեն արդեն գրանցված է' : 'Email already registered',
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await register(form)
      signIn(data)
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'Email already registered') setError(t.errEmail)
      else setError(t.errDef)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Hasmik's <span>Club</span></div>
        <h1 className="auth-title">{t.title}</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">{t.name}
            <input className="auth-input" type="text" value={form.full_name} onChange={set('full_name')} required />
          </label>
          <label className="auth-label">{t.email}
            <input className="auth-input" type="email" value={form.email} onChange={set('email')} required />
          </label>
          <label className="auth-label">{t.password}
            <input className="auth-input" type="password" value={form.password} onChange={set('password')} required minLength={8} />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn-rose auth-submit" type="submit" disabled={loading}>
            {loading ? '...' : t.submit}
          </button>
        </form>
        <p className="auth-footer">
          {t.hasAcc} <Link to="/login" className="auth-link">{t.login}</Link>
        </p>
      </div>
    </div>
  )
}
