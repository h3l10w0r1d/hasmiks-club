import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { guestTicketStart, guestTicketResendCode, guestTicketVerify, guestTicketCheckout } from '../api/events'
import CountryPhoneInput from './CountryPhoneInput'
import { COUNTRIES } from '../data/countries'

const copy = {
  en: {
    title: 'Buy a one-time ticket',
    name: 'Your name',
    email: 'Your email',
    phoneRequired: 'Phone number is required',
    priceLabel: price => `Ticket price: ֏${Number(price).toLocaleString()}`,
    submit: 'Send verification code',
    submitting: 'Sending code…',
    close: 'Close',
    existingAccount: 'An account already exists for this email — please log in and subscribe instead of buying a one-time ticket.',
    goToLogin: 'Go to login',
    genericError: 'Something went wrong — please try again.',
    codeTitle: 'Check your email',
    codeSubtitle: email => `We sent a 6-digit code to ${email}.`,
    codeLabel: 'Verification code',
    verify: 'Verify & continue',
    verifying: 'Verifying…',
    resend: 'Resend code',
    resendIn: s => `Resend code in ${s}s`,
    changeEmail: 'Use a different email',
    payTitle: 'Redirecting to payment…',
  },
  hy: {
    title: 'Գնել մեկանգամյա տոմս',
    name: 'Ձեր անունը',
    email: 'Ձեր էլ. հասցեն',
    phoneRequired: 'Հեռախոսահամարը պարտադիր է',
    priceLabel: price => `Տոմսի արժեքը՝ ֏${Number(price).toLocaleString()}`,
    submit: 'Ուղարկել հաստատման կոդը',
    submitting: 'Ուղարկվում է…',
    close: 'Փակել',
    existingAccount: 'Այս էլ. հասցեով հաշիվ արդեն կա․ խնդրում ենք մուտք գործել և բաժանորդագրվել՝ մեկանգամյա տոմս գնելու փոխարեն:',
    goToLogin: 'Անցնել մուտքի էջ',
    genericError: 'Ինչ-որ բան սխալ գնաց — խնդրում ենք կրկին փորձել:',
    codeTitle: 'Ստուգեք ձեր էլ. փոստը',
    codeSubtitle: email => `Մենք ուղարկեցինք 6-նիշանոց կոդ՝ ${email} հասցեին:`,
    codeLabel: 'Հաստատման կոդ',
    verify: 'Հաստատել և շարունակել',
    verifying: 'Ստուգվում է…',
    resend: 'Կրկին ուղարկել կոդը',
    resendIn: s => `Կրկին ուղարկել՝ ${s}վ հետո`,
    changeEmail: 'Օգտագործել այլ էլ. հասցե',
    payTitle: 'Փոխանցվում է վճարման էջ…',
  },
}

export default function GuestCheckoutModal({ lang = 'en', event, onClose }) {
  const t = copy[lang] ?? copy.en
  const [step, setStep] = useState('form') // form | code | paying
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneCountry, setPhoneCountry] = useState(COUNTRIES[0])
  const [phoneNumber, setPhoneNumber] = useState('')
  const [ticketId, setTicketId] = useState(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [accountExists, setAccountExists] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const timerRef = useRef(null)

  const title = lang === 'hy' && event.title_hy ? event.title_hy : event.title

  useEffect(() => {
    if (resendIn <= 0) return undefined
    timerRef.current = setInterval(() => {
      setResendIn(s => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [resendIn])

  const handleStart = async (e) => {
    e.preventDefault()
    setError('')
    setAccountExists(false)
    setSubmitting(true)
    try {
      const phone = `${phoneCountry.code} ${phoneNumber}`.trim()
      const { ticket_id, resend_available_in } = await guestTicketStart(event.id, { full_name: fullName, email, phone, lang_pref: lang })
      setTicketId(ticket_id)
      setResendIn(resend_available_in)
      setStep('code')
    } catch (err) {
      if (err?.response?.status === 409 && err?.response?.data?.detail?.toLowerCase().includes('account')) {
        setAccountExists(true)
      } else {
        setError(err?.response?.data?.detail || t.genericError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (resendIn > 0 || submitting) return
    setError('')
    setSubmitting(true)
    try {
      const { resend_available_in } = await guestTicketResendCode(event.id, ticketId)
      setResendIn(resend_available_in)
    } catch (err) {
      setError(err?.response?.data?.detail || t.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await guestTicketVerify(event.id, ticketId, code)
      setStep('paying')
      const { url } = await guestTicketCheckout(event.id, ticketId, { full_name: fullName, email, lang_pref: lang })
      window.location.href = url
    } catch (err) {
      setStep('code')
      setError(err?.response?.data?.detail || t.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(44,26,26,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={step === 'paying' ? undefined : onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, padding: '30px 28px', maxWidth: 400, width: '100%', boxShadow: '0 24px 70px rgba(0,0,0,.25)', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        {step !== 'paying' && (
          <button
            onClick={onClose}
            aria-label={t.close}
            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#786050' }}
          >
            <X size={22} />
          </button>
        )}

        {step === 'paying' ? (
          <p style={{ fontSize: 17, fontWeight: 600, color: '#180C04', textAlign: 'center', padding: '30px 10px' }}>{t.payTitle}</p>
        ) : step === 'code' ? (
          <>
            <p style={{ fontSize: 19, fontWeight: 700, color: '#180C04', marginBottom: 4, lineHeight: 1.4, paddingRight: 28 }}>{t.codeTitle}</p>
            <p style={{ fontSize: 15, color: '#786050', marginBottom: 22 }}>{t.codeSubtitle(email)}</p>

            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#786050' }}>
                {t.codeLabel}
                <input
                  required
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoFocus
                  style={{ border: '1px solid #DDD0BA', borderRadius: 8, padding: '12px 14px', fontSize: 24, letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'inherit', color: '#180C04' }}
                />
              </label>

              {error && <p style={{ fontSize: 15, color: '#7E3434', fontWeight: 500, margin: 0 }}>{error}</p>}

              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                style={{
                  marginTop: 6, padding: '14px 20px', borderRadius: 10, border: 'none', cursor: submitting ? 'default' : 'pointer',
                  background: '#7E3434', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', minHeight: 48,
                  opacity: submitting || code.length !== 6 ? 0.6 : 1,
                }}
              >
                {submitting ? t.verifying : t.verify}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendIn > 0 || submitting}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: resendIn > 0 ? 'default' : 'pointer', color: resendIn > 0 ? '#A99B8A' : '#7E3434', fontWeight: 600, fontFamily: 'inherit' }}
                >
                  {resendIn > 0 ? t.resendIn(resendIn) : t.resend}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('form'); setCode(''); setError('') }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#786050', fontFamily: 'inherit' }}
                >
                  {t.changeEmail}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
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
              <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <CountryPhoneInput
                  lang={lang}
                  country={phoneCountry}
                  onCountryChange={setPhoneCountry}
                  number={phoneNumber}
                  onNumberChange={setPhoneNumber}
                  required
                />

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
          </>
        )}
      </div>
    </div>
  )
}
