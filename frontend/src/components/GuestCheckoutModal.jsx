import { useState } from 'react'
import { X } from 'lucide-react'
import { guestCheckout } from '../api/events'

const copy = {
  en: {
    title: 'Buy a one-time ticket',
    name: 'Your name',
    email: 'Your email',
    priceLabel: price => `Ticket price: ֏${Number(price).toLocaleString()}`,
    submit: 'Continue to payment',
    submitting: 'Starting checkout…',
    close: 'Close',
    existingAccount: 'An account already exists for this email — please log in and subscribe instead of buying a one-time ticket.',
    goToLogin: 'Go to login',
    genericError: 'Something went wrong — please try again.',
  },
  hy: {
    title: 'Գնել մեկանգամյա տոմս',
    name: 'Ձեր անունը',
    email: 'Ձեր էլ. հասցեն',
    priceLabel: price => `Տոմսի արժեքը՝ ֏${Number(price).toLocaleString()}`,
    submit: 'Անցնել վճարմանը',
    submitting: 'Սկսվում է վճարումը…',
    close: 'Փակել',
    existingAccount: 'Այս էլ. հասցեով հաշիվ արդեն կա․ խնդրում ենք մուտք գործել և բաժանորդագրվել՝ մեկանգամյա տոմս գնելու փոխարեն:',
    goToLogin: 'Անցնել մուտքի էջ',
    genericError: 'Ինչ-որ բան սխալ գնաց — խնդրում ենք կրկին փորձել:',
  },
}

export default function GuestCheckoutModal({ lang = 'en', event, onClose }) {
  const t = copy[lang] ?? copy.en
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [accountExists, setAccountExists] = useState(false)

  const title = lang === 'hy' && event.title_hy ? event.title_hy : event.title

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setAccountExists(false)
    setSubmitting(true)
    try {
      const { url } = await guestCheckout(event.id, { full_name: fullName, email, lang_pref: lang })
      window.location.href = url
    } catch (err) {
      if (err?.response?.status === 409 && err?.response?.data?.detail?.toLowerCase().includes('account')) {
        setAccountExists(true)
      } else {
        setError(err?.response?.data?.detail || t.genericError)
      }
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(44,26,26,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, padding: '30px 28px', maxWidth: 400, width: '100%', boxShadow: '0 24px 70px rgba(0,0,0,.25)', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t.close}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#786050' }}
        >
          <X size={22} />
        </button>

        <p style={{ fontSize: 19, fontWeight: 700, color: '#180C04', marginBottom: 4, lineHeight: 1.4, paddingRight: 28 }}>{t.title}</p>
        <p style={{ fontSize: 15, color: '#786050', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 16, color: '#7E3434', fontWeight: 700, marginBottom: 22 }}>{t.priceLabel(event.ticket_price)}</p>

        {accountExists ? (
          <div>
            <p style={{ fontSize: 16, color: '#7E3434', lineHeight: 1.6, marginBottom: 20 }}>{t.existingAccount}</p>
            <a
              href="/login"
              style={{ display: 'block', textAlign: 'center', padding: '14px 20px', borderRadius: 10, background: '#7E3434', color: '#fff', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}
            >
              {t.goToLogin}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#786050' }}>
              {t.name}
              <input
                required value={fullName} onChange={e => setFullName(e.target.value)}
                style={{ border: '1px solid #DDD0BA', borderRadius: 8, padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', color: '#180C04' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#786050' }}>
              {t.email}
              <input
                required type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={{ border: '1px solid #DDD0BA', borderRadius: 8, padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', color: '#180C04' }}
              />
            </label>

            {error && <p style={{ fontSize: 16, color: '#7E3434', fontWeight: 500, margin: 0 }}>{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 6, padding: '14px 20px', borderRadius: 10, border: 'none', cursor: submitting ? 'default' : 'pointer',
                background: '#7E3434', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', minHeight: 48,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
