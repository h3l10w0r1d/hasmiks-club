import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { register } from '../api/auth'
import { getPublicSettings } from '../api/payments'
import { useAuth } from '../context/AuthContext'
import GlobalHeader from '../components/GlobalHeader'
import AuthShell from '../components/AuthShell'
import GoogleSignInButton from '../components/GoogleSignInButton'
import TelegramLoginButton from '../components/TelegramLoginButton'

// Everything except the password survives a refresh or accidental back-nav —
// losing an already-typed name/email mid-registration is exactly the kind
// of thing that makes an older member give up rather than retype it. The
// password itself is deliberately left out of the saved snapshot.
const DRAFT_KEY = 'hc_register_draft'
// Read once by DashboardPage on its very next mount to decide whether to
// show the post-registration package popup — see the note in handleSubmit
// below for why this can't be router navigation state. Keep this string in
// sync with the matching constant in DashboardPage.jsx.
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

export default function RegisterPage({ lang }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
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
    pendingInfo: lang === 'hy' ? 'Ձեր դիմումն ընդունված է: Ադմինիստրատորն ամենաշուտ կպատասխանի:' : 'Your application has been received and is pending review. You\'ll hear from us soon!',
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
        referral_code: refCode || null,
        application_message: requireApproval ? (form.application_message || null) : null,
      }
      const data = await register(payload)
      // Approved accounts (no manual review) land on the dashboard and see
      // the membership package popup right away — a real choice to
      // subscribe now or skip for later. Pending (manual-review) accounts
      // land on the same dashboard without it, since they can't buy a
      // package yet. A sessionStorage flag, not router navigation state:
      // signIn() below sets `user`, which makes GuestOnlyRoute redirect
      // away from this page on its own the instant that context update
      // lands — a race against any navigate(..., {state}) call made here,
      // which GuestOnlyRoute's own (stateless) redirect reliably wins,
      // silently dropping the state before DashboardPage ever sees it.
      if (data.user?.application_status !== 'pending') {
        try { sessionStorage.setItem(JUST_REGISTERED_KEY, '1') } catch { /* storage unavailable */ }
      }
      signIn(data)
      clearDraft()
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
    <>
    <Helmet defer={false}>
      <title>{`${t.title} — Hasmik's Club`}</title>
      <link rel="canonical" href="https://www.hasmiksclub.am/register" />
    </Helmet>
    <GlobalHeader lang={lang} />
    <AuthShell lang={lang} active="register">
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
          onSuccess={(data) => {
            if (data.user?.application_status !== 'pending') {
              try { sessionStorage.setItem(JUST_REGISTERED_KEY, '1') } catch { /* storage unavailable */ }
            }
            signIn(data)
            clearDraft()
            navigate('/dashboard')
          }}
          onError={setError} />
        <TelegramLoginButton lang={lang} referralCode={refCode}
          onSuccess={(data) => {
            if (data.user?.application_status !== 'pending') {
              try { sessionStorage.setItem(JUST_REGISTERED_KEY, '1') } catch { /* storage unavailable */ }
            }
            signIn(data)
            clearDraft()
            navigate('/dashboard')
          }}
          onError={setError} />
      </div>

      <p className="auth-footer">
        {t.hasAcc} <Link to="/login" className="auth-link">{t.login}</Link>
      </p>
    </AuthShell>
    </>
  )
}
