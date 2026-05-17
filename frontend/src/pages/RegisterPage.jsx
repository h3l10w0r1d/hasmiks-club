import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { register } from '../api/auth'
import { getPublicSettings } from '../api/payments'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage({ lang }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''

  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    bio: '', lang_pref: lang || 'en',
    referral_code: refCode,
    application_message: '',
  })
  const [requireApproval, setRequireApproval] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getPublicSettings().then(s => setRequireApproval(!!s.require_approval)).catch(() => {})
  }, [])

  const t = {
    title:       lang === 'hy' ? 'Միանալ համայնքին' : 'Join the Circle',
    name:        lang === 'hy' ? 'Անուն Ազգանուն' : 'Full Name',
    email:       lang === 'hy' ? 'Էլ. հասցե' : 'Email',
    password:    lang === 'hy' ? 'Գաղտնաբառ' : 'Password',
    bio:         lang === 'hy' ? 'Ձեր մասին (կամընտիր)' : 'About you (optional)',
    bioHint:     lang === 'hy' ? 'Ներկայացրե՛ք ձեզ մյուս անդամներին' : 'Introduce yourself to the community',
    appMsg:      lang === 'hy' ? 'Ինչու՞ եք ուզում անդամ դառնալ' : 'Why do you want to join?',
    appMsgHint:  lang === 'hy' ? 'Ձեր դիմումը կուղարկվի ադմինիստրատորի հաստատման համար' : 'Your application will be reviewed before your account is activated',
    refLabel:    lang === 'hy' ? 'Հրավիրողի կոդ' : 'Referral code',
    submit:      lang === 'hy' ? 'Ուղարկել դիմում' : requireApproval ? 'Submit Application' : 'Create Account',
    hasAcc:      lang === 'hy' ? 'Արդեն հաշիվ ունե՞ք։' : 'Already have an account?',
    login:       lang === 'hy' ? 'Մուտք գործել' : 'Sign In',
    errDef:      lang === 'hy' ? 'Գրանցման սխալ' : 'Registration failed. Try again.',
    errEmail:    lang === 'hy' ? 'Այս էլ. հասցեն արդեն գրանցված է' : 'Email already registered',
    pendingInfo: lang === 'hy' ? 'Ձեր դիմումն ընդունված է: Ադմինիստրատորն ամենաշուտ կразберется:' : 'Your application has been received and is pending review. You\'ll hear from us soon!',
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        lang_pref: form.lang_pref,
        bio: form.bio || null,
        referral_code: form.referral_code || null,
        application_message: requireApproval ? (form.application_message || null) : null,
      }
      const data = await register(payload)
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

        {requireApproval && (
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#795548' }}>
            ℹ️ {t.appMsgHint}
          </div>
        )}

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

          <label className="auth-label">{t.bio}
            <textarea
              className="auth-input"
              style={{ minHeight: 72, resize: 'vertical' }}
              placeholder={t.bioHint}
              value={form.bio}
              onChange={set('bio')}
            />
          </label>

          {requireApproval && (
            <label className="auth-label">{t.appMsg}
              <textarea
                className="auth-input"
                style={{ minHeight: 80, resize: 'vertical' }}
                value={form.application_message}
                onChange={set('application_message')}
                required={requireApproval}
              />
            </label>
          )}

          <label className="auth-label">{t.refLabel}
            <input
              className="auth-input"
              type="text"
              value={form.referral_code}
              onChange={set('referral_code')}
              placeholder="e.g. ABC12345"
              style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}
            />
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
