import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { getPublicEvents } from '../api/events'

export default function EventsPage({ lang }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const t = {
    title:    lang === 'hy' ? 'Առաջիկա հանդիպումներ' : 'Upcoming Events',
    sub:      lang === 'hy' ? 'Միացե՛ք մեզ Hasmik\'s Club-ի հաջորդ հանդիպմանը' : "Join us at Hasmik's Club next gathering",
    noEvents: lang === 'hy' ? 'Առայժմ առաջիկա հանդիպումներ չկան' : 'No upcoming events right now',
    seats:    lang === 'hy' ? 'տեղ' : 'seats left',
    full:     lang === 'hy' ? 'Ամբողջությամբ ամրագրված' : 'Fully booked',
    join:     lang === 'hy' ? 'Գրանցվե՛ք անդամ' : 'Join the club to RSVP',
    back:     lang === 'hy' ? '← Գլխավոր' : '← Home',
    login:    lang === 'hy' ? 'Մուտք' : 'Sign In',
    register: lang === 'hy' ? 'Գրանցվել' : 'Join the Circle',
  }

  useEffect(() => {
    getPublicEvents().then(setEvents).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const pageTitle = lang === 'hy' ? "Հանդիպումներ — Hasmik's Club" : "Upcoming Events — Hasmik's Club"
  const pageDesc = lang === 'hy'
    ? 'Hasmik\'s Club-ի առաջիկա հանդիպումներն ու միջոցառումները Երևանում:'
    : "Browse upcoming gatherings and events hosted by Hasmik's Club in Yerevan."

  return (
    <div style={{ minHeight: '100vh', background: '#fff8f5' }}>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="website" />
      </Helmet>
      {/* nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 40px', background: '#fff', boxShadow: '0 1px 0 #f0e0e5' }}>
        <Link to="/" style={{ textDecoration: 'none', fontFamily: 'Georgia, serif', fontSize: 22, color: '#c0394b', fontWeight: 700 }}>
          Hasmik's <span style={{ color: '#2c1a1a' }}>Club</span>
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login" className="nav-btn" style={{ textDecoration: 'none', padding: '8px 20px', borderRadius: 8, border: '1.5px solid #c0394b', color: '#c0394b', fontSize: 14, fontWeight: 600 }}>{t.login}</Link>
          <Link to="/register" className="btn-rose" style={{ textDecoration: 'none', padding: '8px 20px', borderRadius: 8, background: '#c0394b', color: '#fff', fontSize: 14, fontWeight: 600 }}>{t.register}</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: '#2c1a1a', marginBottom: 8 }}>{t.title}</h1>
        <p style={{ color: '#888', marginBottom: 40 }}>{t.sub}</p>

        {loading && <p style={{ color: '#aaa' }}>Loading…</p>}

        {!loading && events.length === 0 && (
          <p style={{ color: '#888', fontStyle: 'italic' }}>{t.noEvents}</p>
        )}

        {events.map(ev => (
          <div key={ev.id} style={{
            background: '#fff', borderRadius: 16, padding: '28px 32px', marginBottom: 20,
            boxShadow: '0 2px 12px rgba(192,57,75,.07)', border: '1px solid #f5ecee',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 8px', fontSize: 22, color: '#2c1a1a', fontFamily: 'Georgia, serif' }}>
                  {lang === 'hy' && ev.title_hy ? ev.title_hy : ev.title}
                </h2>
                <p style={{ margin: '0 0 12px', color: '#888', fontSize: 14 }}>
                  📍 {ev.location} &nbsp;·&nbsp;
                  🗓 {new Date(ev.event_date).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {(lang === 'hy' && ev.description_hy ? ev.description_hy : ev.description) && (
                  <p style={{ color: '#555', lineHeight: 1.6, margin: 0 }}>
                    {lang === 'hy' && ev.description_hy ? ev.description_hy : ev.description}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {ev.is_full
                  ? <span style={{ color: '#c0394b', fontWeight: 600, fontSize: 14 }}>{t.full}</span>
                  : <span style={{ color: '#2ecc71', fontWeight: 600, fontSize: 14 }}>{ev.seats_available} {t.seats}</span>
                }
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f5ecee' }}>
              <Link
                to="/register"
                style={{
                  display: 'inline-block', padding: '10px 24px', borderRadius: 8,
                  background: '#c0394b', color: '#fff', textDecoration: 'none',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                {t.join} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
