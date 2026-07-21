import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Flower2, MapPin, CalendarDays, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPublicEvent, getEvent, rsvp, cancelRsvp } from '../api/events'
import { cldOptimize } from '../utils/cloudinary'
import { getMe } from '../api/members'
import { createCheckout } from '../api/payments'
import { sanitizeHtml } from '../utils/sanitizeHtml'
import GlobalHeader from '../components/GlobalHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import GuestCheckoutModal from '../components/GuestCheckoutModal'

const copy = {
  en: {
    notFound:     'Event not found',
    backToEvents: 'All events',
    seatsLeft:    n => `${n} seat${n === 1 ? '' : 's'} left`,
    full:         'Fully booked',
    attend:       'Attend',
    attending:    '✓ Attending',
    cancel:       'Cancel RSVP',
    loading:      'Loading event…',
    memberOnly:   'Members can RSVP instantly. Sign in or join to attend.',
    upgradeTitle: 'Active membership required',
    upgradeDesc:  'Subscribe to get instant access to all events.',
    upgrade:      'Subscribe now',
    rsvpSuccess:  'You\'re in! Check your email for details.',
    cancelSuccess:'RSVP cancelled.',
    error:        'Something went wrong — please try again.',
    buyTicket:    price => `Buy a one-time ticket — ֏${Number(price).toLocaleString()}`,
    guestSoldOut: 'One-time tickets are sold out for this event.',
    past:         'This event has already happened.',
    viewOnMap:    'View on map',
  },
  hy: {
    notFound:     'Հանդիպումը չի գտնվել',
    backToEvents: 'Բոլոր հանդիպումները',
    seatsLeft:    n => `${n} տեղ`,
    full:         'Ամբողջությամբ ամրագրված',
    attend:       'Մասնակցել',
    attending:    '✓ Գրանցված',
    cancel:       'Չեղարկել',
    loading:      'Բեռնվում է…',
    memberOnly:   'Անդամները կարող են անմիջապես գրանցվել: Մուտք գործե՛ք կամ գրանցվե՛ք:',
    upgradeTitle: 'Ակտիվ անդամակցություն պահանջվում է',
    upgradeDesc:  'Բաժանորդագրվե՛ք՝ բոլոր հանդիպումներին մասնակցելու համար:',
    upgrade:      'Բաժանորդագրվել',
    rsvpSuccess:  'Գրանցված եք: Ստուգե՛ք ձեր էլ. փոստը:',
    cancelSuccess:'Գրանցումը չեղարկված է:',
    error:        'Ինչ-որ բան սխալ գնաց — խնդրում ենք կրկին փորձել:',
    buyTicket:    price => `Գնել մեկանգամյա տոմս — ֏${Number(price).toLocaleString()}`,
    guestSoldOut: 'Այս միջոցառման մեկանգամյա տոմսերը սպառված են:',
    past:         'Այս միջոցառումն արդեն կայացել է:',
    viewOnMap:    'Դիտել քարտեզի վրա',
  },
}

function formatDate(iso, lang) {
  return new Date(iso).toLocaleDateString(
    lang === 'hy' ? 'hy-AM' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  )
}

export default function EventDetailPage({ lang = 'en' }) {
  const { id } = useParams()
  const { user, setUser, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const t = copy[lang] ?? copy.en

  const [ev, setEv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [guestModalOpen, setGuestModalOpen] = useState(false)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const load = useCallback(async (isAuthed) => {
    setLoading(true)
    setNotFound(false)
    try {
      const data = isAuthed ? await getEvent(id) : await getPublicEvent(id)
      setEv(data)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!authLoading) load(!!user)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, id])

  useEffect(() => {
    if (!authLoading && user) getMe().then(setUser).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, id])

  const handleAttend = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/events/${id}` } })
      return
    }
    if (user.membership_status !== 'active') {
      setCheckoutLoading(true)
      try {
        const { url } = await createCheckout()
        window.location.href = url
      } catch {
        showToast(t.error, 'error')
        setCheckoutLoading(false)
      }
      return
    }
    if (ev.user_has_rsvp) {
      setConfirmCancel(true)
      return
    }
    setBusy(true)
    try {
      await rsvp(ev.id)
      showToast(t.rsvpSuccess)
      load(true)
    } catch (err) {
      showToast(err?.response?.data?.detail || t.error, 'error')
    } finally {
      setBusy(false)
    }
  }

  const doCancelRsvp = async () => {
    setBusy(true)
    try {
      await cancelRsvp(ev.id)
      showToast(t.cancelSuccess)
      load(true)
    } catch {
      showToast(t.error, 'error')
    } finally {
      setBusy(false)
    }
  }

  const buttonProps = () => {
    if (!user) return { label: t.attend, style: styles.btnPrimary }
    if (user.membership_status !== 'active') return { label: t.attend, style: styles.btnPrimary }
    if (ev.user_has_rsvp) return { label: t.attending, style: styles.btnAttending }
    if (ev.is_full || ev.seats_available === 0) return { label: t.full, style: styles.btnDisabled, disabled: true }
    return { label: t.attend, style: styles.btnPrimary }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <GlobalHeader lang={lang} />
        <p style={styles.dim}>{t.loading}</p>
      </div>
    )
  }

  if (notFound || !ev) {
    return (
      <div style={styles.page}>
        <GlobalHeader lang={lang} />
        <div style={styles.emptyState}>
          <Flower2 size={36} strokeWidth={1.5} color="var(--rose)" />
          <p style={{ marginTop: 12, color: '#786050', fontSize: 16 }}>{t.notFound}</p>
          <Link to="/events" style={{ ...styles.btnOutline, marginTop: 16, textDecoration: 'none' }}>{t.backToEvents}</Link>
        </div>
      </div>
    )
  }

  const bp = buttonProps()
  const title = lang === 'hy' && ev.title_hy ? ev.title_hy : ev.title
  const desc  = lang === 'hy' && ev.description_hy ? ev.description_hy : ev.description
  const isPast = new Date(ev.event_date) < new Date()

  return (
    <div style={styles.page}>
      <Helmet>
        <title>{title} — Hasmik's Club</title>
        {desc && <meta name="description" content={desc.replace(/<[^>]*>/g, ' ').slice(0, 200)} />}
        <meta property="og:title" content={title} />
        <meta property="og:type" content="article" />
        {ev.cover_url && <meta property="og:image" content={ev.cover_url} />}
      </Helmet>

      <GlobalHeader lang={lang} />

      <div style={styles.container}>
        <Link to="/events" style={styles.backLink}><ArrowLeft size={15} /> {t.backToEvents}</Link>

        <div style={styles.card}>
          {ev.cover_url && (
            <img src={cldOptimize(ev.cover_url, { width: 1200 })} alt={title} style={styles.coverImg} />
          )}

          <div style={styles.cardBody}>
            <div style={styles.cardTop}>
              <div style={{ flex: 1 }}>
                <h1 style={styles.title}>{title}</h1>
                <div style={styles.meta}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={14} /> {ev.location}</span>
                  {ev.map_url && (
                    <a href={ev.map_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--rose, #7E3434)', textDecoration: 'underline', fontSize: 13 }}>
                      {t.viewOnMap}
                    </a>
                  )}
                  <span style={{ color: '#ddd' }}>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CalendarDays size={14} /> {formatDate(ev.event_date, lang)}</span>
                </div>
              </div>
              {!isPast && (
                <span style={ev.is_full || ev.seats_available === 0 ? styles.badgeFull : styles.badgeOpen}>
                  {ev.is_full || ev.seats_available === 0 ? t.full : t.seatsLeft(ev.seats_available)}
                </span>
              )}
            </div>

            {desc && (
              <div className="rich-content" style={styles.desc} dangerouslySetInnerHTML={{ __html: sanitizeHtml(desc) }} />
            )}

            {isPast ? (
              <p style={styles.hint}>{t.past}</p>
            ) : (
              <div style={styles.cardFooter}>
                <button
                  style={{ ...bp.style, opacity: busy || bp.disabled ? 0.65 : 1, cursor: busy || bp.disabled ? 'default' : 'pointer' }}
                  onClick={() => !bp.disabled && handleAttend()}
                  disabled={busy || !!bp.disabled}
                >
                  {busy ? '…' : bp.label}
                </button>

                {!user && (
                  <>
                    <span style={styles.hint}>{t.memberOnly}</span>
                    {ev.ticket_price != null && !ev.is_full && (
                      ev.guest_tickets_full ? (
                        <span style={styles.hint}>{t.guestSoldOut}</span>
                      ) : (
                        <button style={styles.btnOutline} onClick={() => setGuestModalOpen(true)}>
                          {t.buyTicket(ev.ticket_price)}
                        </button>
                      )
                    )}
                  </>
                )}

                {user && user.membership_status !== 'active' && (
                  <div style={styles.upgradeBanner}>
                    <div>
                      <strong style={{ fontSize: 15 }}>{t.upgradeTitle}</strong>
                      <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>{t.upgradeDesc}</p>
                    </div>
                    <button
                      style={styles.upgradeBtn}
                      onClick={async () => {
                        setCheckoutLoading(true)
                        try { const { url } = await createCheckout(); window.location.href = url }
                        catch { showToast(t.error, 'error'); setCheckoutLoading(false) }
                      }}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? '…' : t.upgrade}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ ...styles.toast, background: toast.type === 'error' ? '#7E3434' : '#1a3a2a' }}>
          {toast.msg}
        </div>
      )}

      {confirmCancel && (
        <ConfirmDialog
          lang={lang}
          title={lang === 'hy' ? 'Չեղարկե՞լ գրանցումը' : 'Cancel your RSVP?'}
          body={lang === 'hy' ? `Ձեր տեղը «${title}»-ի համար կազատվի:` : `Your spot for "${title}" will be released.`}
          confirmLabel={t.cancel}
          onConfirm={() => { doCancelRsvp(); setConfirmCancel(false) }}
          onCancel={() => setConfirmCancel(false)}
        />
      )}

      {guestModalOpen && (
        <GuestCheckoutModal lang={lang} event={ev} onClose={() => setGuestModalOpen(false)} />
      )}
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#fff8f5', fontFamily: "'Jost', 'Noto Sans Armenian', 'Inter', sans-serif" },
  container: { maxWidth: 760, margin: '0 auto', padding: '24px 24px 64px' },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#786050', fontSize: 14, textDecoration: 'none', marginBottom: 16 },
  card: { background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(126,52,52,.07)', border: '1px solid #f5ecee', overflow: 'hidden' },
  coverImg: { width: '100%', height: 340, objectFit: 'cover', display: 'block' },
  cardBody: { padding: '32px 36px 36px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 20 },
  title: { margin: '0 0 10px', fontSize: 30, color: '#2c1a1a', fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif", fontWeight: 600, lineHeight: 1.2 },
  meta: { display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 14, color: '#786050', alignItems: 'center' },
  desc: { color: '#4a3a3a', lineHeight: 1.7, fontSize: 16, marginBottom: 28 },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 14, paddingTop: 20, borderTop: '1px solid #f5ecee', flexWrap: 'wrap' },
  hint: { fontSize: 14, color: '#786050' },
  badgeOpen: { display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#edfaf3', color: '#2a7a50', fontSize: 12, fontWeight: 600, border: '1px solid #c5eddb', flexShrink: 0 },
  badgeFull: { display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#fef2f2', color: '#7E3434', fontSize: 12, fontWeight: 600, border: '1px solid #f5d0d0', flexShrink: 0 },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 26px', borderRadius: 8, background: '#7E3434', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', letterSpacing: '0.03em' },
  btnAttending: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 26px', borderRadius: 8, background: '#edfaf3', color: '#2a7a50', fontSize: 14, fontWeight: 600, border: '1.5px solid #c5eddb', cursor: 'pointer', letterSpacing: '0.03em' },
  btnDisabled: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 26px', borderRadius: 8, background: '#f5f5f5', color: '#bbb', fontSize: 14, fontWeight: 600, border: '1px solid #eee', cursor: 'default', letterSpacing: '0.03em' },
  btnOutline: { display: 'inline-flex', alignItems: 'center', padding: '9px 20px', borderRadius: 8, border: '1.5px solid #7E3434', color: '#7E3434', fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', background: 'none' },
  upgradeBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'linear-gradient(135deg, #7E3434 0%, #a04040 100%)', color: '#fff', padding: '16px 22px', borderRadius: 10, width: '100%' },
  upgradeBtn: { padding: '9px 22px', borderRadius: 8, background: '#fff', color: '#7E3434', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0, letterSpacing: '0.03em' },
  toast: { position: 'fixed', bottom: 28, right: 28, color: '#fff', padding: '14px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', zIndex: 999, maxWidth: 340, lineHeight: 1.4 },
  emptyState: { textAlign: 'center', padding: '80px 24px' },
  dim: { color: '#786050', fontSize: 16, textAlign: 'center', padding: '80px 0' },
}
