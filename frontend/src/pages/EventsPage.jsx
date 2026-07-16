import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Flower2, MapPin, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPublicEvents, getEvents, rsvp, cancelRsvp } from '../api/events'
import { cldOptimize } from '../utils/cloudinary'
import { stripHtml } from '../utils/sanitizeHtml'
import { getMe } from '../api/members'
import { createCheckout } from '../api/payments'
import GlobalHeader from '../components/GlobalHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import GuestCheckoutModal from '../components/GuestCheckoutModal'

/* ─── i18n ──────────────────────────────────────────────────────────────── */
const copy = {
  en: {
    pageTitle:    "Upcoming Events — Hasmik's Club",
    pageDesc:     "Browse upcoming gatherings and events hosted by Hasmik's Club in Yerevan.",
    heading:      'Upcoming Events',
    sub:          "Join us at Hasmik's Club next gathering",
    noEvents:     'No upcoming events right now — check back soon!',
    seatsLeft:    n => `${n} seat${n === 1 ? '' : 's'} left`,
    full:         'Fully booked',
    attend:       'Attend',
    attending:    '✓ Attending',
    cancel:       'Cancel RSVP',
    signIn:       'Sign In',
    joinClub:     'Join the Circle',
    loading:      'Loading events…',
    // CTA copy when unauthenticated
    memberOnly:   'Members can RSVP instantly. Sign in or join to attend.',
    // CTA copy when no subscription
    upgradeTitle: 'Active membership required',
    upgradeDesc:  'Subscribe to get instant access to all events.',
    upgrade:      'Subscribe now',
    // toast
    rsvpSuccess:  'You\'re in! Check your email for details.',
    cancelSuccess:'RSVP cancelled.',
    error:        'Something went wrong — please try again.',
    // one-time guest ticket
    buyTicket:    price => `Buy a one-time ticket — ֏${Number(price).toLocaleString()}`,
    ticketSuccess:'Ticket confirmed! Check your email for details.',
    ticketFailed: 'Your ticket payment didn\'t go through — please try again.',
    guestSoldOut: 'One-time tickets are sold out for this event.',
    readMore:     'Read more →',
  },
  hy: {
    pageTitle:    "Առաջիկա հանդիպումներ — Hasmik's Club",
    pageDesc:     "Hasmik's Club-ի առաջիկա հանդիպումներն ու միջոցառումները Երևանում:",
    heading:      'Առաջիկա հանդիպումներ',
    sub:          "Միացե՛ք մեզ Hasmik's Club-ի հաջորդ հանդիպմանը",
    noEvents:     'Առայժմ առաջիկա հանդիպումներ չկան',
    seatsLeft:    n => `${n} տեղ`,
    full:         'Ամբողջությամբ ամրագրված',
    attend:       'Մասնակցել',
    attending:    '✓ Գրանցված',
    cancel:       'Չեղարկել',
    signIn:       'Մուտք',
    joinClub:     'Գրանցվել',
    loading:      'Բեռնվում է…',
    memberOnly:   'Անդամները կարող են անմիջապես գրանցվել: Մուտք գործե՛ք կամ գրանցվե՛ք:',
    upgradeTitle: 'Ակտիվ անդամակցություն պահանջվում է',
    upgradeDesc:  'Բաժանորդագրվե՛ք՝ բոլոր հանդիպումներին մասնակցելու համար:',
    upgrade:      'Բաժանորդագրվել',
    rsvpSuccess:  'Գրանցված եք: Ստուգե՛ք ձեր էլ. փոստը:',
    cancelSuccess:'Գրանցումը չեղարկված է:',
    error:        'Ինչ-որ բան սխալ գնաց — խնդրում ենք կրկին փորձել:',
    buyTicket:    price => `Գնել մեկանգամյա տոմս — ֏${Number(price).toLocaleString()}`,
    ticketSuccess:'Տոմսը հաստատված է: Ստուգե՛ք ձեր էլ. փոստը:',
    ticketFailed: 'Տոմսի վճարումը չհաջողվեց — խնդրում ենք կրկին փորձել:',
    guestSoldOut: 'Այս միջոցառման մեկանգամյա տոմսերը սպառված են:',
    readMore:     'Ավելին →',
  },
}

function truncate(text, max = 160) {
  if (text.length <= max) return text
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

/* ─── helpers ───────────────────────────────────────────────────────────── */
function formatDate(iso, lang) {
  return new Date(iso).toLocaleDateString(
    lang === 'hy' ? 'hy-AM' : 'en-GB',
    { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  )
}

function SeatsBadge({ ev, t }) {
  if (ev.is_full || ev.seats_available === 0) {
    return <span style={styles.badgeFull}>{t.full}</span>
  }
  return <span style={styles.badgeOpen}>{t.seatsLeft(ev.seats_available)}</span>
}

// Intl has no short-month data for hy-AM in most JS engines (silently falls
// back to English), so Armenian abbreviations are spelled out by hand here.
const MONTHS_HY = ['ՀՆՎ', 'ՓԵՏ', 'ՄԱՐ', 'ԱՊՐ', 'ՄԱՅ', 'ՀՈՒՆ', 'ՀՈՒԼ', 'ՕԳՍ', 'ՍԵՊ', 'ՀՈԿ', 'ՆՈՅ', 'ԴԵԿ']

// Torn-calendar-page date tile: weekday+month on the rose header strip, the
// day number large underneath — pinned over the cover image corner.
function DateTile({ iso, lang }) {
  const d = new Date(iso)
  const top = lang === 'hy' ? MONTHS_HY[d.getMonth()] : d.toLocaleDateString('en-GB', { month: 'short' })
  const day = d.toLocaleDateString('en-GB', { day: 'numeric' })
  return (
    <div style={styles.dateTile}>
      <div style={styles.dateTileTop}>{top}</div>
      <div style={styles.dateTileDay}>{day}</div>
    </div>
  )
}

/* ─── main component ─────────────────────────────────────────────────────── */
export default function EventsPage({ lang = 'en' }) {
  const { user, setUser, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const t = copy[lang] ?? copy.en

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({})          // { [eventId]: true } during RSVP calls
  const [toast, setToast] = useState(null)       // { msg, type }
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(null) // event to confirm-cancel, or null
  const [guestModalEvent, setGuestModalEvent] = useState(null) // event to buy a one-time ticket for, or null

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Land here after a guest ticket purchase — Ameriabank redirects back to
  // /events?ticket=success|failed since a guest has no dashboard to return to.
  useEffect(() => {
    const ticket = searchParams.get('ticket')
    if (!ticket) return
    showToast(ticket === 'success' ? t.ticketSuccess : t.ticketFailed, ticket === 'success' ? 'success' : 'error')
    setSearchParams(p => { p.delete('ticket'); return p }, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* fetch events — authenticated route returns rsvp state */
  const loadEvents = useCallback(async (isAuthed) => {
    setLoading(true)
    try {
      const data = isAuthed ? await getEvents() : await getPublicEvents()
      setEvents(data)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, []) // no user dep — isAuthed passed as argument so this never re-creates

  useEffect(() => {
    if (!authLoading) loadEvents(!!user)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]) // only run once when auth resolves, not on every user object change

  // Refresh membership_status on mount — e.g. arriving here right after a
  // successful Ameriabank payment shouldn't show a stale "inactive" state
  // just because AuthContext hasn't been touched since an earlier page load.
  useEffect(() => {
    if (!authLoading && user) {
      getMe().then(setUser).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  /* RSVP / cancel */
  const handleAttend = async (ev) => {
    // Not logged in → send to login with return path
    if (!user) {
      navigate('/login', { state: { from: '/events' } })
      return
    }
    // No active subscription → send to Ameriabank checkout
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
    // Already attending → confirm before cancelling (a mis-tap here loses your spot)
    if (ev.user_has_rsvp) {
      setConfirmCancel(ev)
      return
    }
    // Normal RSVP
    setBusy(b => ({ ...b, [ev.id]: true }))
    try {
      await rsvp(ev.id)
      showToast(t.rsvpSuccess)
      loadEvents(true)
    } catch (err) {
      const msg = err?.response?.data?.detail || t.error
      showToast(msg, 'error')
    } finally {
      setBusy(b => ({ ...b, [ev.id]: false }))
    }
  }

  const doCancelRsvp = async (ev) => {
    setBusy(b => ({ ...b, [ev.id]: true }))
    try {
      await cancelRsvp(ev.id)
      showToast(t.cancelSuccess)
      loadEvents(true)
    } catch {
      showToast(t.error, 'error')
    } finally {
      setBusy(b => ({ ...b, [ev.id]: false }))
    }
  }

  /* button label + style per state */
  const buttonProps = (ev) => {
    if (!user) return { label: t.attend, style: styles.btnPrimary }
    if (user.membership_status !== 'active') return { label: t.attend, style: styles.btnPrimary }
    if (ev.user_has_rsvp) return { label: t.attending, style: styles.btnAttending }
    if (ev.is_full || ev.seats_available === 0) return { label: t.full, style: styles.btnDisabled, disabled: true }
    return { label: t.attend, style: styles.btnPrimary }
  }

  return (
    <div style={styles.page}>
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="description" content={t.pageDesc} />
        <meta property="og:title" content={t.pageTitle} />
        <meta property="og:description" content={t.pageDesc} />
        <meta property="og:type" content="website" />
      </Helmet>

      <GlobalHeader lang={lang} />

      {/* ── hero ────────────────────────────────────────────────────── */}
      <div style={styles.hero}>
        <h1 style={styles.h1}>{t.heading}</h1>
        <p style={styles.sub}>{t.sub}</p>
      </div>

      {/* ── upgrade banner for logged-in but inactive users ────────── */}
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

      {/* ── events list ─────────────────────────────────────────────── */}
      <div style={styles.container}>
        {loading && <p style={styles.dim}>{t.loading}</p>}

        {!loading && events.length === 0 && (
          <div style={styles.emptyState}>
            <Flower2 size={36} strokeWidth={1.5} color="var(--rose)" />
            <p style={{ marginTop: 12, color: '#786050', fontSize: 16 }}>{t.noEvents}</p>
          </div>
        )}

        {events.map(ev => {
          const bp = buttonProps(ev)
          const title = lang === 'hy' && ev.title_hy ? ev.title_hy : ev.title
          const descRaw = lang === 'hy' && ev.description_hy ? ev.description_hy : ev.description
          const desc = descRaw ? truncate(stripHtml(descRaw)) : ''
          return (
            <div key={ev.id} style={{ ...styles.card, cursor: 'pointer' }} onClick={() => navigate(`/events/${ev.id}`)}>
              {/* cover image + calendar date tile */}
              {ev.cover_url && (
                <div style={styles.coverWrap}>
                  <img
                    src={cldOptimize(ev.cover_url, { width: 800 })}
                    alt={title}
                    style={styles.coverImg}
                  />
                  <DateTile iso={ev.event_date} lang={lang} />
                </div>
              )}

              <div style={styles.cardBody}>
                {/* card header */}
                <div style={styles.cardTop}>
                  <div style={{ flex: 1 }}>
                    <h2 style={styles.cardTitle}>{title}</h2>
                    <div style={styles.meta}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} /> {ev.location}</span>
                      <span style={{ color: '#ddd' }}>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CalendarDays size={13} /> {formatDate(ev.event_date, lang)}</span>
                    </div>
                    {desc && <p style={styles.desc}>{desc}</p>}
                    <Link to={`/events/${ev.id}`} style={styles.readMore} onClick={e => e.stopPropagation()}>{t.readMore}</Link>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <SeatsBadge ev={ev} t={t} />
                  </div>
                </div>

                {/* card footer */}
                <div style={styles.cardFooter} onClick={e => e.stopPropagation()}>
                  <button
                    style={{ ...bp.style, opacity: busy[ev.id] || bp.disabled ? 0.65 : 1, cursor: busy[ev.id] || bp.disabled ? 'default' : 'pointer' }}
                    onClick={() => !bp.disabled && handleAttend(ev)}
                    disabled={!!busy[ev.id] || !!bp.disabled}
                  >
                    {busy[ev.id] ? '…' : bp.label}
                  </button>

                  {/* unauthenticated hint + one-time ticket option */}
                  {!user && (
                    <>
                      <span style={styles.hint}>{t.memberOnly}</span>
                      {ev.ticket_price != null && !ev.is_full && (
                        ev.guest_tickets_full ? (
                          <span style={styles.hint}>{t.guestSoldOut}</span>
                        ) : (
                          <button style={styles.btnOutline} onClick={() => setGuestModalEvent(ev)}>
                            {t.buyTicket(ev.ticket_price)}
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          ...styles.toast,
          background: toast.type === 'error' ? '#7E3434' : '#1a3a2a',
        }}>
          {toast.msg}
        </div>
      )}

      {confirmCancel && (
        <ConfirmDialog
          lang={lang}
          title={lang === 'hy' ? 'Չեղարկե՞լ գրանցումը' : 'Cancel your RSVP?'}
          body={lang === 'hy' ? `Ձեր տեղը «${confirmCancel.title}»-ի համար կազատվի:` : `Your spot for "${confirmCancel.title}" will be released.`}
          confirmLabel={t.cancel}
          onConfirm={() => { doCancelRsvp(confirmCancel); setConfirmCancel(null) }}
          onCancel={() => setConfirmCancel(null)}
        />
      )}

      {guestModalEvent && (
        <GuestCheckoutModal lang={lang} event={guestModalEvent} onClose={() => setGuestModalEvent(null)} />
      )}
    </div>
  )
}

/* ─── styles ─────────────────────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight: '100vh',
    background: '#fff8f5',
    fontFamily: "'Jost', 'Noto Sans Armenian', 'Inter', sans-serif",
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 40px',
    background: '#fff',
    boxShadow: '0 1px 0 #f0e0e5',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  brand: {
    textDecoration: 'none',
    fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif",
    fontSize: 22,
    color: '#7E3434',
    fontWeight: 700,
  },
  hero: {
    textAlign: 'center',
    padding: '60px 24px 32px',
    background: 'linear-gradient(to bottom, #fff, #fff8f5)',
  },
  h1: {
    fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif",
    fontSize: 42,
    color: '#2c1a1a',
    margin: '0 0 12px',
    fontWeight: 600,
  },
  sub: {
    color: '#786050',
    fontSize: 16,
    margin: 0,
  },
  container: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '24px 24px 64px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    boxShadow: '0 2px 12px rgba(126,52,52,.07)',
    border: '1px solid #f5ecee',
    overflow: 'hidden',
  },
  coverWrap: {
    position: 'relative',
  },
  coverImg: {
    width: '100%',
    height: 320,
    objectFit: 'cover',
    display: 'block',
  },
  dateTile: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 62,
    borderRadius: 12,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 8px 24px rgba(24,12,4,.22)',
    textAlign: 'center',
    fontFamily: "'Jost', 'Noto Sans Armenian', 'Inter', sans-serif",
  },
  dateTileTop: {
    background: '#7E3434',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '4px 0',
  },
  dateTileDay: {
    color: '#2c1a1a',
    fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif",
    fontSize: 26,
    fontWeight: 700,
    padding: '4px 0 6px',
    lineHeight: 1,
  },
  cardBody: {
    padding: '32px 36px 36px',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    flexWrap: 'wrap',
  },
  cardTitle: {
    margin: '0 0 8px',
    fontSize: 22,
    color: '#2c1a1a',
    fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif",
    fontWeight: 600,
  },
  meta: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    fontSize: 14,
    color: '#786050',
    marginBottom: 10,
    alignItems: 'center',
  },
  desc: {
    color: '#555',
    lineHeight: 1.6,
    fontSize: 16,
    margin: 0,
  },
  readMore: {
    display: 'inline-block',
    marginTop: 8,
    color: '#7E3434',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginTop: 20,
    paddingTop: 16,
    borderTop: '1px solid #f5ecee',
    flexWrap: 'wrap',
  },
  hint: {
    fontSize: 14,
    color: '#786050',
  },
  badgeOpen: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 20,
    background: '#edfaf3',
    color: '#2a7a50',
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #c5eddb',
  },
  badgeFull: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 20,
    background: '#fef2f2',
    color: '#7E3434',
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #f5d0d0',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 24px',
    borderRadius: 8,
    background: '#7E3434',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s',
    letterSpacing: '0.03em',
  },
  btnAttending: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 24px',
    borderRadius: 8,
    background: '#edfaf3',
    color: '#2a7a50',
    fontSize: 14,
    fontWeight: 600,
    border: '1.5px solid #c5eddb',
    cursor: 'pointer',
    transition: 'background 0.15s',
    letterSpacing: '0.03em',
  },
  btnDisabled: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 24px',
    borderRadius: 8,
    background: '#f5f5f5',
    color: '#bbb',
    fontSize: 14,
    fontWeight: 600,
    border: '1px solid #eee',
    cursor: 'default',
    letterSpacing: '0.03em',
  },
  btnOutline: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 18px',
    borderRadius: 8,
    border: '1.5px solid #7E3434',
    color: '#7E3434',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  upgradeBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #7E3434 0%, #a04040 100%)',
    color: '#fff',
    padding: '16px 40px',
  },
  upgradeBtn: {
    padding: '9px 22px',
    borderRadius: 8,
    background: '#fff',
    color: '#7E3434',
    fontSize: 14,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    letterSpacing: '0.03em',
  },
  toast: {
    position: 'fixed',
    bottom: 28,
    right: 28,
    color: '#fff',
    padding: '14px 22px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    zIndex: 999,
    maxWidth: 340,
    lineHeight: 1.4,
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 0',
  },
  dim: {
    color: '#786050',
    fontSize: 16,
    textAlign: 'center',
    padding: '40px 0',
  },
}
