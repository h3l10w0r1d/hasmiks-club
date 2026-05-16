import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'

export default function ForgotPasswordPage({ lang }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const t = {
    title:       lang === 'hy' ? 'Մոռացե՞լ եք գաղտնաբառը' : 'Forgot password?',
    sub:         lang === 'hy' ? 'Մուտքագրեք ձեր էլ. հասցեն' : 'Enter your email address',
    email:       lang === 'hy' ? 'Էլ. հասցե' : 'Email',
    send:        lang === 'hy' ? 'Ուղարկել' : 'Send reset link',
    sentTitle:   lang === 'hy' ? 'Ստուգեք ձեր նամակը' : 'Check your email',
    sentMsg:     lang === 'hy' ? 'Վերակայման հղումն ուղարկվել է:' : 'If that email exists, a reset link was sent.',
    back:        lang === 'hy' ? '← Վերադառնալ մուտք' : '← Back to login',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch {
      setError(lang === 'hy' ? 'Սխալ տեղի ունեցավ' : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Hasmik's <span>Club</span></div>

        {sent ? (
          <>
            <h2 className="auth-title">{t.sentTitle}</h2>
            <p style={{ textAlign: 'center', color: '#555', marginBottom: '24px' }}>{t.sentMsg}</p>
            <Link to="/login" className="btn-rose auth-submit" style={{ textDecoration: 'none', textAlign: 'center' }}>
              {t.back}
            </Link>
          </>
        ) : (
          <>
            <h2 className="auth-title">{t.title}</h2>
            <p style={{ textAlign: 'center', color: '#555', marginBottom: '24px' }}>{t.sub}</p>
            <form onSubmit={handleSubmit}>
              <label className="auth-label">{t.email}
                <input
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button className="btn-rose auth-submit" type="submit" disabled={loading}>
                {loading ? '...' : t.send}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: '16px' }}>
              <Link to="/login" style={{ color: 'var(--rose)' }}>{t.back}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
