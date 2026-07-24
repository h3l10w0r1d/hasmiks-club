import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2 } from 'lucide-react'
import GlobalHeader from '../components/GlobalHeader'
import { useAuth } from '../context/AuthContext'
import { createCheckout, getPublicSettings } from '../api/payments'
import content from '../data/content'

const copy = {
  en: {
    metaTitle: "Welcome — Hasmik's Club",
    eyebrow: 'Welcome',
    sub: "Your account is ready. Here's everything waiting for you as a full member.",
    skip: 'Skip for now',
    error: 'Could not start checkout — please try again.',
  },
  hy: {
    metaTitle: "Բարի գալուստ — Hasmik's Club",
    eyebrow: 'Բարի գալուստ',
    sub: "Ձեր հաշիվը ստեղծված է։ Ահա թե ինչ է ձեզ սպասվում որպես լիարժեք անդամ։",
    skip: 'Բաց թողնել առայժմ',
    error: 'Չհաջողվեց սկսել վճարումը։ Խնդրում ենք փորձել կրկին։',
  },
}

export default function WelcomePage({ lang = 'en', setLang }) {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState('')
  const [planPrices, setPlanPrices] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState('1')

  const hy = lang === 'hy'
  const t = copy[lang] ?? copy.en
  const c = content.pricing

  // Already an active member (e.g. came back here via browser history) — nothing to propose.
  useEffect(() => {
    if (!authLoading && user?.membership_status === 'active') {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    getPublicSettings().then((s) => setPlanPrices(s.membership_plans)).catch(() => {})
  }, [])

  const handleSubscribe = async () => {
    setCheckoutLoading(true)
    setError('')
    try {
      const { url } = await createCheckout(selectedPlan)
      window.location.href = url
    } catch {
      setError(t.error)
      setCheckoutLoading(false)
    }
  }

  if (authLoading || !user || user.membership_status === 'active') return null

  return (
    <div className="page-shell">
      <Helmet>
        <title>{t.metaTitle}</title>
      </Helmet>
      <GlobalHeader lang={lang} setLang={setLang} />

      <main className="page-main">
        <section className="page-hero">
          <div className="page-eyebrow">{t.eyebrow}</div>
          <h1 className="page-title">
            {hy ? `Բարի գալուստ, ${user.full_name?.split(' ')[0] || ''}!` : `Welcome, ${user.full_name?.split(' ')[0] || ''}!`}
          </h1>
          <p className="page-sub">{t.sub}</p>
        </section>

        <div className="page-body">
          <section className="page-section">
            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--deep)', marginBottom: 14 }}>
              {hy ? 'Ընտրեք ձեր փաթեթը' : 'Choose your package'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
              {c.plans.map((plan, i) => {
                const planId = String(i + 1)
                const selected = selectedPlan === planId
                const price = planPrices?.[planId]
                return (
                  <button key={planId} type="button" onClick={() => setSelectedPlan(planId)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: '18px 20px',
                      border: `2px solid ${selected ? 'var(--rose)' : 'var(--sand, #e5d5d5)'}`,
                      background: selected ? 'var(--rose-bg, #fdecec)' : '#fff',
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--deep)', marginBottom: 4 }}>
                      {hy ? plan.nameHy : plan.nameEn}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--rose)', marginBottom: 10 }}>
                      {price != null ? `֏${Number(price).toLocaleString()}` : `֏${plan.price}`} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--taupe)' }}>{hy ? c.perMonthHy : c.perMonthEn}</span>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(hy ? plan.itemsHy : plan.itemsEn).map((item, j) => (
                        <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                          <CheckCircle2 size={14} strokeWidth={2} color="var(--rose)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
          </section>

          {error && (
            <p style={{ background: '#fdecea', color: '#c0392b', borderRadius: 10, padding: '12px 16px', fontSize: 13.5, marginTop: 20 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 32 }}>
            <button
              onClick={handleSubscribe}
              disabled={checkoutLoading}
              className="page-cta"
              style={{ border: 'none', cursor: checkoutLoading ? 'default' : 'pointer', opacity: checkoutLoading ? 0.7 : 1, marginTop: 0 }}
            >
              {checkoutLoading ? (hy ? 'Բեռնվում է…' : 'Loading…') : (hy ? c.btnHy : c.btnEn)}
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'none', border: 'none', color: 'var(--taupe)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13.5 }}
            >
              {t.skip}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
