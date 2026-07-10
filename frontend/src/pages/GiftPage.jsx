import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Gift, Plus, Minus } from 'lucide-react'
import GlobalHeader from '../components/GlobalHeader'
import CountryPhoneInput from '../components/CountryPhoneInput'
import { COUNTRIES } from '../data/countries'
import { getPublicEvents } from '../api/events'
import { getPublicSettings } from '../api/payments'
import { giftStart, giftResendCode, giftVerify, giftCheckout } from '../api/gift'

const copy = {
  en: {
    pageTitle: "Gift a Membership or Tickets — Hasmik's Club",
    pageDesc: "Give someone you love a Hasmik's Club membership or event tickets.",
    heading: 'Give the gift of Hasmik\'s Club',
    sub: 'A membership, or a night out — sent straight to someone you love',
    giverSection: 'Your details',
    yourName: 'Your name',
    yourEmail: 'Your email',
    recipientSection: "Who's this for?",
    recipientName: "Recipient's name",
    recipientEmail: "Recipient's email",
    anonymous: 'Send anonymously (hide my name from the recipient)',
    giftTypeSection: 'What would you like to gift?',
    typeMembership: 'A membership',
    typeEvents: 'Event ticket(s)',
    durationLabel: 'How long?',
    months: n => `${n} month${n === 1 ? '' : 's'}`,
    eventsLabel: 'Pick one or more events',
    noEvents: 'No events with one-time tickets available right now.',
    qty: 'qty',
    total: 'Total',
    submit: 'Send verification code',
    submitting: 'Sending code…',
    genericError: 'Something went wrong — please try again.',
    codeTitle: 'Check your email',
    codeSubtitle: email => `We sent a 6-digit code to ${email}.`,
    codeLabel: 'Verification code',
    verify: 'Verify & continue to payment',
    verifying: 'Verifying…',
    resend: 'Resend code',
    resendIn: s => `Resend code in ${s}s`,
    changeDetails: 'Go back and edit',
    payTitle: 'Redirecting to payment…',
    successToast: 'Your gift is on its way! Check your email for the receipt.',
    failedToast: 'The payment didn\'t go through — please try again.',
    required: 'Please fill in all required fields',
    selectAtLeastOne: 'Please select at least one event',
  },
  hy: {
    pageTitle: "Նվիրեք անդամակցություն կամ տոմսեր — Hasmik's Club",
    pageDesc: "Նվիրեք ձեր սիրելիին Hasmik's Club-ի անդամակցություն կամ միջոցառման տոմսեր:",
    heading: "Նվիրեք Hasmik's Club",
    sub: 'Անդամակցություն կամ երեկո՝ ուղարկված ուղիղ ձեր սիրելիին',
    giverSection: 'Ձեր տվյալները',
    yourName: 'Ձեր անունը',
    yourEmail: 'Ձեր էլ. հասցեն',
    recipientSection: 'Ո՞ւմ համար է սա',
    recipientName: 'Ստացողի անունը',
    recipientEmail: 'Ստացողի էլ. հասցեն',
    anonymous: 'Ուղարկել անանուն (թաքցնել իմ անունը ստացողից)',
    giftTypeSection: 'Ի՞նչ եք ցանկանում նվիրել',
    typeMembership: 'Անդամակցություն',
    typeEvents: 'Միջոցառման տոմս(եր)',
    durationLabel: 'Որքա՞ն ժամանակով',
    months: n => `${n} ամիս`,
    eventsLabel: 'Ընտրեք մեկ կամ մի քանի միջոցառում',
    noEvents: 'Այս պահին մեկանգամյա տոմսերով միջոցառումներ չկան:',
    qty: 'քանակ',
    total: 'Ընդամենը',
    submit: 'Ուղարկել հաստատման կոդը',
    submitting: 'Ուղարկվում է…',
    genericError: 'Ինչ-որ բան սխալ գնաց — խնդրում ենք կրկին փորձել:',
    codeTitle: 'Ստուգեք ձեր էլ. փոստը',
    codeSubtitle: email => `Մենք ուղարկեցինք 6-նիշանոց կոդ՝ ${email} հասցեին:`,
    codeLabel: 'Հաստատման կոդ',
    verify: 'Հաստատել և անցնել վճարմանը',
    verifying: 'Ստուգվում է…',
    resend: 'Կրկին ուղարկել կոդը',
    resendIn: s => `Կրկին ուղարկել՝ ${s}վ հետո`,
    changeDetails: 'Վերադառնալ և խմբագրել',
    payTitle: 'Փոխանցվում է վճարման էջ…',
    successToast: 'Ձեր նվերն ուղարկվում է: Ստուգե՛ք ձեր էլ. փոստը:',
    failedToast: 'Վճարումը չհաջողվեց — խնդրում ենք կրկին փորձել:',
    required: 'Խնդրում ենք լրացնել բոլոր պարտադիր դաշտերը',
    selectAtLeastOne: 'Խնդրում ենք ընտրել առնվազն մեկ միջոցառում',
  },
}

const DURATIONS = [1, 3, 6, 12]

export default function GiftPage({ lang = 'en' }) {
  const t = copy[lang] ?? copy.en
  const [searchParams, setSearchParams] = useSearchParams()

  const [step, setStep] = useState('form') // form | code | paying
  const [giverName, setGiverName] = useState('')
  const [giverEmail, setGiverEmail] = useState('')
  const [giverCountry, setGiverCountry] = useState(COUNTRIES[0])
  const [giverPhoneNum, setGiverPhoneNum] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientCountry, setRecipientCountry] = useState(COUNTRIES[0])
  const [recipientPhoneNum, setRecipientPhoneNum] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [giftType, setGiftType] = useState('membership')
  const [durationMonths, setDurationMonths] = useState(1)
  const [events, setEvents] = useState([])
  const [cart, setCart] = useState({}) // { [eventId]: quantity }
  const [prices, setPrices] = useState({ 1: null, 3: null, 6: null, 12: null })

  const [giftId, setGiftId] = useState(null)
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }, [])

  useEffect(() => {
    getPublicEvents().then(list => setEvents(list.filter(ev => ev.ticket_price != null && !ev.is_full))).catch(() => {})
    getPublicSettings().then(s => { if (s.gift_prices) setPrices(s.gift_prices) }).catch(() => {})
  }, [])

  useEffect(() => {
    const outcome = searchParams.get('gift')
    if (!outcome) return
    showToast(outcome === 'success' ? t.successToast : t.failedToast, outcome === 'success' ? 'success' : 'error')
    setSearchParams(p => { p.delete('gift'); return p }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const id = setInterval(() => setResendIn(s => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [resendIn])

  const eventCartLines = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => {
    const ev = events.find(e => String(e.id) === id)
    return ev ? { event: ev, quantity: q } : null
  }).filter(Boolean)

  const eventsTotal = eventCartLines.reduce((sum, l) => sum + Number(l.event.ticket_price) * l.quantity, 0)
  const membershipTotal = prices[durationMonths] ?? 0
  const total = giftType === 'membership' ? membershipTotal : eventsTotal

  const setQty = (eventId, delta) => {
    setCart(c => {
      const next = Math.max(0, (c[eventId] || 0) + delta)
      return { ...c, [eventId]: next }
    })
  }

  const handleStart = async (e) => {
    e.preventDefault()
    setError('')
    if (!giverName || !giverEmail || !recipientName || !recipientEmail) {
      setError(t.required)
      return
    }
    if (giftType === 'events' && eventCartLines.length === 0) {
      setError(t.selectAtLeastOne)
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        giver_name: giverName, giver_email: giverEmail,
        giver_phone: giverPhoneNum ? `${giverCountry.code} ${giverPhoneNum}` : null,
        recipient_name: recipientName, recipient_email: recipientEmail,
        recipient_phone: recipientPhoneNum ? `${recipientCountry.code} ${recipientPhoneNum}` : null,
        anonymous, gift_type: giftType, lang_pref: lang,
      }
      if (giftType === 'membership') {
        payload.duration_months = durationMonths
      } else {
        payload.event_selections = eventCartLines.map(l => ({ event_id: l.event.id, quantity: l.quantity }))
      }
      const { gift_id, resend_available_in } = await giftStart(payload)
      setGiftId(gift_id)
      setResendIn(resend_available_in)
      setStep('code')
    } catch (err) {
      setError(err?.response?.data?.detail || t.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (resendIn > 0 || submitting) return
    setError('')
    setSubmitting(true)
    try {
      const { resend_available_in } = await giftResendCode(giftId)
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
      await giftVerify(giftId, code)
      setStep('paying')
      const { url } = await giftCheckout(giftId, lang)
      window.location.href = url
    } catch (err) {
      setStep('code')
      setError(err?.response?.data?.detail || t.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="description" content={t.pageDesc} />
      </Helmet>

      <GlobalHeader lang={lang} />

      <div style={styles.hero}>
        <Gift size={34} strokeWidth={1.5} color="var(--rose, #7E3434)" />
        <h1 style={styles.h1}>{t.heading}</h1>
        <p style={styles.sub}>{t.sub}</p>
      </div>

      <div style={styles.container}>
        <div style={styles.card}>
          {step === 'paying' ? (
            <p style={{ fontSize: 17, fontWeight: 600, color: '#180C04', textAlign: 'center', padding: '30px 10px' }}>{t.payTitle}</p>
          ) : step === 'code' ? (
            <>
              <p style={styles.cardTitle}>{t.codeTitle}</p>
              <p style={{ fontSize: 15, color: '#786050', marginBottom: 22 }}>{t.codeSubtitle(giverEmail)}</p>
              <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={styles.label}>
                  {t.codeLabel}
                  <input
                    required autoFocus value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                    style={{ ...styles.input, fontSize: 24, letterSpacing: '0.3em', textAlign: 'center' }}
                  />
                </label>
                {error && <p style={styles.error}>{error}</p>}
                <button type="submit" disabled={submitting || code.length !== 6} style={{ ...styles.btnPrimary, opacity: submitting || code.length !== 6 ? 0.6 : 1 }}>
                  {submitting ? t.verifying : t.verify}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <button type="button" onClick={handleResend} disabled={resendIn > 0 || submitting} style={{ ...styles.linkBtn, color: resendIn > 0 ? '#A99B8A' : '#7E3434' }}>
                    {resendIn > 0 ? t.resendIn(resendIn) : t.resend}
                  </button>
                  <button type="button" onClick={() => { setStep('form'); setCode(''); setError('') }} style={styles.linkBtn}>
                    {t.changeDetails}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

              <div>
                <p style={styles.sectionTitle}>{t.giverSection}</p>
                <div style={styles.fieldGrid}>
                  <label style={styles.label}>
                    {t.yourName}
                    <input required value={giverName} onChange={e => setGiverName(e.target.value)} style={styles.input} />
                  </label>
                  <label style={styles.label}>
                    {t.yourEmail}
                    <input required type="email" value={giverEmail} onChange={e => setGiverEmail(e.target.value)} style={styles.input} />
                  </label>
                </div>
                <div style={{ marginTop: 14 }}>
                  <CountryPhoneInput lang={lang} country={giverCountry} onCountryChange={setGiverCountry} number={giverPhoneNum} onNumberChange={setGiverPhoneNum} />
                </div>
              </div>

              <div>
                <p style={styles.sectionTitle}>{t.recipientSection}</p>
                <div style={styles.fieldGrid}>
                  <label style={styles.label}>
                    {t.recipientName}
                    <input required value={recipientName} onChange={e => setRecipientName(e.target.value)} style={styles.input} />
                  </label>
                  <label style={styles.label}>
                    {t.recipientEmail}
                    <input required type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} style={styles.input} />
                  </label>
                </div>
                <div style={{ marginTop: 14 }}>
                  <CountryPhoneInput lang={lang} country={recipientCountry} onCountryChange={setRecipientCountry} number={recipientPhoneNum} onNumberChange={setRecipientPhoneNum} />
                </div>
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />
                  {t.anonymous}
                </label>
              </div>

              <div>
                <p style={styles.sectionTitle}>{t.giftTypeSection}</p>
                <div style={styles.typeToggle}>
                  <button type="button" onClick={() => setGiftType('membership')} style={giftType === 'membership' ? styles.typeBtnActive : styles.typeBtn}>
                    {t.typeMembership}
                  </button>
                  <button type="button" onClick={() => setGiftType('events')} style={giftType === 'events' ? styles.typeBtnActive : styles.typeBtn}>
                    {t.typeEvents}
                  </button>
                </div>

                {giftType === 'membership' ? (
                  <div style={{ marginTop: 16 }}>
                    <p style={styles.smallLabel}>{t.durationLabel}</p>
                    <div style={styles.durationRow}>
                      {DURATIONS.map(m => (
                        <button
                          key={m} type="button" onClick={() => setDurationMonths(m)}
                          style={durationMonths === m ? styles.durationBtnActive : styles.durationBtn}
                        >
                          <span style={{ fontWeight: 700 }}>{t.months(m)}</span>
                          {prices[m] != null && <span style={{ fontSize: 12, opacity: 0.8 }}>֏{Number(prices[m]).toLocaleString()}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <p style={styles.smallLabel}>{t.eventsLabel}</p>
                    {events.length === 0 ? (
                      <p style={{ fontSize: 14, color: '#A99B8A' }}>{t.noEvents}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {events.map(ev => {
                          const title = lang === 'hy' && ev.title_hy ? ev.title_hy : ev.title
                          const qty = cart[ev.id] || 0
                          return (
                            <div key={ev.id} style={styles.eventRow}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#180C04' }}>{title}</p>
                                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#786050' }}>֏{Number(ev.ticket_price).toLocaleString()}</p>
                              </div>
                              <div style={styles.qtyControl}>
                                <button type="button" onClick={() => setQty(ev.id, -1)} disabled={qty === 0} style={styles.qtyBtn}><Minus size={14} /></button>
                                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                                <button type="button" onClick={() => setQty(ev.id, 1)} style={styles.qtyBtn}><Plus size={14} /></button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {total > 0 && (
                <div style={styles.totalRow}>
                  <span>{t.total}</span>
                  <span style={{ fontWeight: 700, color: '#7E3434', fontSize: 18 }}>֏{Number(total).toLocaleString()}</span>
                </div>
              )}

              {error && <p style={styles.error}>{error}</p>}

              <button type="submit" disabled={submitting} style={{ ...styles.btnPrimary, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? t.submitting : t.submit}
              </button>
            </form>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ ...styles.toast, background: toast.type === 'success' ? '#1a100a' : '#7E3434' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#fff8f5', fontFamily: "'Jost', 'Noto Sans Armenian', 'Inter', sans-serif" },
  hero: { textAlign: 'center', padding: '52px 24px 28px', background: 'linear-gradient(to bottom, #fff, #fff8f5)' },
  h1: { fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif", fontSize: 38, color: '#2c1a1a', margin: '12px 0 10px', fontWeight: 600 },
  sub: { color: '#786050', fontSize: 15, margin: 0 },
  container: { maxWidth: 620, margin: '0 auto', padding: '8px 20px 64px' },
  card: { background: '#fff', borderRadius: 20, padding: '30px 28px', boxShadow: '0 4px 24px rgba(126,52,52,.08)' },
  cardTitle: { fontSize: 19, fontWeight: 700, color: '#180C04', marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7E3434', marginBottom: 12 },
  smallLabel: { fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#786050', marginBottom: 10 },
  fieldGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#786050' },
  input: { border: '1px solid #DDD0BA', borderRadius: 8, padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', color: '#180C04' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#786050', fontWeight: 500, textTransform: 'none', letterSpacing: 0, cursor: 'pointer' },
  typeToggle: { display: 'flex', gap: 8 },
  typeBtn: { flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #DDD0BA', background: '#fff', color: '#786050', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  typeBtnActive: { flex: 1, padding: '12px 14px', borderRadius: 10, border: '1px solid #7E3434', background: '#7E3434', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  durationRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  durationBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '12px 6px', borderRadius: 10, border: '1px solid #DDD0BA', background: '#fff', color: '#786050', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  durationBtnActive: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '12px 6px', borderRadius: 10, border: '1px solid #7E3434', background: '#FBF0EE', color: '#7E3434', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  eventRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #EEE3D0', borderRadius: 10 },
  qtyControl: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, border: '1px solid #DDD0BA', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7E3434' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#FBF6EC', borderRadius: 10, fontSize: 14, color: '#48301E', fontWeight: 600 },
  error: { fontSize: 14, color: '#7E3434', fontWeight: 500, margin: 0 },
  btnPrimary: { padding: '15px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#7E3434', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', minHeight: 50 },
  linkBtn: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', color: '#786050' },
  toast: { position: 'fixed', bottom: 28, right: 28, color: '#fff', padding: '14px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', zIndex: 999, maxWidth: 340, lineHeight: 1.4 },
}
