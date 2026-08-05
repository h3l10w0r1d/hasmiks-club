import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { register } from '../api/auth'
import { getPublicSettings } from '../api/payments'
import { useAuth } from '../context/AuthContext'
import GoogleSignInButton from './GoogleSignInButton'
import TelegramLoginButton from './TelegramLoginButton'

// Everything except the password survives a refresh or accidental back-nav —
// losing an already-typed name/email mid-registration is exactly the kind
// of thing that makes an older member give up rather than retype it. The
// password itself is deliberately left out of the saved snapshot.
const DRAFT_KEY = 'hc_register_draft'
// Read once by DashboardPage on its very next mount to decide whether to
// show the post-registration package popup. Keep this string in sync with
// the matching constant in DashboardPage.jsx.
const JUST_REGISTERED_KEY = 'hc_just_registered'

function loadDraft(lang) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')
    if (saved) return { ...saved, password: '' }
  } catch { /* ignore corrupt draft */ }
  return {
    full_name: '', email: '', password: '',
    lang_pref: lang || 'hy',
    application_message: '',
  }
}

// The actual signup form body — shared by RegisterPage (a real route, for
// direct links/bookmarks/SEO) and AuthModal (the popup). `onSuccess` lets
// each caller decide what happens next.
export default function RegisterForm({ lang, onSuccess, onSwitchToLogin }) {
  const { signIn } = useAuth()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''

  const [form, setForm] = useState(() => loadDraft(lang))
  const [requireApproval, setRequireApproval] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const { password, ...draft } = form
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* storage unavailable */ }
  }, [form])

  const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ } }

  useEffect(() => {
    getPublicSettings().then(s => setRequireApproval(!!s.require_approval)).catch(() => {})
  }, [])

  const t = {
    title:       lang === 'hy' ? 'Միանալ ակումբին' : 'Join the Club',
    name:        lang === 'hy' ? 'Անուն Ազգանուն' : 'Full Name',
    email:       lang === 'hy' ? 'Էլ. հասցե' : 'Email',
    password:    lang === 'hy' ? 'Գաղտնաբառ' : 'Password',
    appMsg:      lang === 'hy' ? 'Ինչու՞ եք ուզում անդամ դառնալ' : 'Why do you want to join?',
    appMsgHint:  lang === 'hy' ? 'Ձեր դիմումը կուղարկվի ադմինիստրատորի հաստատման համար' : 'Your application will be reviewed before your account is activated',
    submit:      lang === 'hy' ? 'Ուղարկել դիմում' : requireApproval ? 'Submit Application' : 'Create Account',
    hasAcc:      lang === 'hy' ? 'Արդեն հաշիվ ունե՞ք։' : 'Already have an account?',
    login:       lang === 'hy' ? 'Մուտք գործել' : 'Sign In',
    errDef:      lang === 'hy' ? 'Գրանցման սխալ' : 'Registration failed. Try again.',
    errEmail:    lang === 'hy' ? 'Այս էլ. հասցեն արդեն գրանցված է' : 'Email already registered',
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const markJustRegistered = (data) => {
    if (data.user?.application_status !== 'pending') {
      try { sessionStorage.setItem(JUST_REGISTERED_KEY, '1') } catch { /* storage unavailable */ }
    }
  }

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
        referral_code: refCode || null,
        application_message: requireApproval ? (form.application_message || null) : null,
      }
      const data = await register(payload)
      // Approved accounts (no manual review) land on the dashboard and see
      // the membership package popup right away. Pending (manual-review)
      // accounts land on the same dashboard without it.
      markJustRegistered(data)
      signIn(data)
      clearDraft()
      onSuccess(data)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'Email already registered') setError(t.errEmail)
      else setError(t.errDef)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="auth-title">{t.title}</h1>

      {requireApproval && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 15, color: '#5c3d1f' }}>
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

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-rose auth-submit" type="submit" disabled={loading}>
          {loading ? '...' : t.submit}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--sand)' }} />
        <span style={{ fontSize: 14, color: 'var(--taupe)' }}>{lang === 'hy' ? 'կամ' : 'or'}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--sand)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <GoogleSignInButton lang={lang} referralCode={refCode}
          onSuccess={(data) => { markJustRegistered(data); signIn(data); clearDraft(); onSuccess(data) }}
          onError={setError} />
        <TelegramLoginButton lang={lang} referralCode={refCode}
          onSuccess={(data) => { markJustRegistered(data); signIn(data); clearDraft(); onSuccess(data) }}
          onError={setError} />
      </div>

      <p className="auth-footer">
        {t.hasAcc}{' '}
        {onSwitchToLogin
          ? <button type="button" className="auth-link auth-link-btn" onClick={onSwitchToLogin}>{t.login}</button>
          : <Link to="/login" className="auth-link">{t.login}</Link>}
      </p>
    </>
  )
}
