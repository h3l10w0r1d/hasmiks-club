import { useState, useEffect } from 'react'
import PackagePicker from './PackagePicker'
import { getPublicPackages, checkoutPackage } from '../api/packages'
import content from '../data/content'

const copy = {
  en: {
    eyebrow: 'Welcome',
    sub: 'Your account is ready. Choose your package to get started.',
    choose: 'Choose your package',
    skip: 'Skip for now',
    error: 'Could not start checkout — please try again.',
    loading: 'Loading…',
  },
  hy: {
    eyebrow: 'Բարի գալուստ',
    sub: 'Ձեր հաշիվը ստեղծված է։ Ընտրեք ձեր փաթեթը՝ սկսելու համար։',
    choose: 'Ընտրեք ձեր փաթեթը',
    skip: 'Բաց թողնել առայժմ',
    error: 'Չհաջողվեց սկսել վճարումը։ Խնդրում ենք փորձել կրկին։',
    loading: 'Բեռնվում է…',
  },
}

// Shown immediately after a successful registration (auto-approved
// accounts only) as an overlay on the dashboard — the same package-picking
// UI as WelcomePage, just delivered as a popup instead of a page
// navigation. Follows this codebase's convention (see WelcomePage,
// GiftPage) of each surface owning its own fetch/select/checkout state
// rather than sharing it through a common hook.
export default function PostRegisterPackageModal({ lang = 'en', user, onSkip, onSuccess }) {
  const hy = lang === 'hy'
  const t = copy[lang] ?? copy.en
  const c = content.pricing

  const [packages, setPackages] = useState([])
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getPublicPackages().then((list) => {
      setPackages(list)
      setSelectedPackage((prev) => prev ?? list[0]?.id ?? null)
    }).catch(() => {})
  }, [])

  const handleBuy = async () => {
    if (!selectedPackage) return
    setCheckoutLoading(true)
    setError('')
    try {
      const result = await checkoutPackage(selectedPackage, lang)
      if (result.mode === 'redirect') {
        window.location.href = result.url
        return
      }
      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.message || t.error)
        setCheckoutLoading(false)
      }
    } catch {
      setError(t.error)
      setCheckoutLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(44,26,26,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
      onClick={checkoutLoading ? undefined : onSkip}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', maxWidth: 660, width: '100%', boxShadow: '0 24px 70px rgba(0,0,0,.25)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textTransform: 'uppercase', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--rose, #7E3434)', marginBottom: 6 }}>
          {t.eyebrow}
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif", fontSize: 30, color: 'var(--deep, #180C04)', margin: '0 0 10px' }}>
          {hy ? `Բարի գալուստ, ${user?.full_name?.split(' ')[0] || ''}!` : `Welcome, ${user?.full_name?.split(' ')[0] || ''}!`}
        </h2>
        <p style={{ color: 'var(--taupe, #786050)', fontSize: 15, marginBottom: 26 }}>{t.sub}</p>

        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--deep, #180C04)', marginBottom: 14 }}>{t.choose}</p>
        <PackagePicker packages={packages} selected={selectedPackage} onSelect={setSelectedPackage} lang={lang} />

        {error && (
          <p style={{ background: '#fdecea', color: '#c0392b', borderRadius: 10, padding: '12px 16px', fontSize: 13.5, marginTop: 20 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 28 }}>
          <button
            onClick={handleBuy}
            disabled={checkoutLoading || !selectedPackage}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 10, border: 'none', cursor: checkoutLoading ? 'default' : 'pointer',
              background: 'var(--rose, #7E3434)', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
              minHeight: 48, opacity: checkoutLoading || !selectedPackage ? 0.7 : 1,
            }}
          >
            {checkoutLoading ? t.loading : (hy ? c.btnHy : c.btnEn)}
          </button>
          <button
            onClick={onSkip}
            style={{ background: 'none', border: 'none', color: 'var(--taupe, #786050)', textDecoration: 'underline', cursor: 'pointer', fontSize: 13.5 }}
          >
            {t.skip}
          </button>
        </div>
      </div>
    </div>
  )
}
