import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function ResetPasswordPage({ lang }) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const t = {
    title:    lang === 'hy' ? 'Նոր գաղտնաբառ' : 'Set new password',
    password: lang === 'hy' ? 'Նոր գաղտնաբառ' : 'New password',
    confirm:  lang === 'hy' ? 'Հաստատել' : 'Confirm password',
    save:     lang === 'hy' ? 'Պահպանել' : 'Save password',
    mismatch: lang === 'hy' ? 'Գաղտնաբառերը չեն համընկնում' : 'Passwords do not match',
    invalid:  lang === 'hy' ? 'Անվավեր կամ ժամկետանց հղում' : 'Invalid or expired link',
    noToken:  lang === 'hy' ? 'Հղումն անվավեր է' : 'Invalid reset link',
  }

  useEffect(() => {
    if (!token) setError(t.noToken)
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError(t.mismatch); return }
    setError('')
    setLoading(true)
    try {
      const data = await resetPassword(token, password)
      signIn(data)
      navigate('/dashboard')
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(detail || t.invalid)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Hasmik's <span>Club</span></div>
        <h2 className="auth-title">{t.title}</h2>
        <form onSubmit={handleSubmit}>
          <label className="auth-label">{t.password}
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <label className="auth-label">{t.confirm}
            <input
              className="auth-input"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn-rose auth-submit" type="submit" disabled={loading || !token}>
            {loading ? '...' : t.save}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/login" style={{ color: 'var(--rose)' }}>← {lang === 'hy' ? 'Մուտք' : 'Back to login'}</Link>
        </p>
      </div>
    </div>
  )
}
