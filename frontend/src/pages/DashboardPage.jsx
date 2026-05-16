import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMe, updateMe } from '../api/members'
import { getEvents, rsvp, cancelRsvp } from '../api/events'
import { getLibrary } from '../api/content'

const TABS = ['profile', 'events', 'library']

export default function DashboardPage({ lang }) {
  const { user, setUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('profile')
  const [events, setEvents] = useState([])
  const [library, setLibrary] = useState([])
  const [profileForm, setProfileForm] = useState({ full_name: '', photo_url: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const t = {
    profile:     lang === 'hy' ? 'Պրոֆիլ' : 'Profile',
    events:      lang === 'hy' ? 'Հանդիպումներ' : 'Events',
    library:     lang === 'hy' ? 'Գրադարան' : 'Library',
    signOut:     lang === 'hy' ? 'Ելք' : 'Sign Out',
    welcome:     lang === 'hy' ? 'Բարի գալուստ' : 'Welcome back',
    memberSince: lang === 'hy' ? 'Անդամ է' : 'Member since',
    status:      lang === 'hy' ? 'Կարգավիճակ' : 'Status',
    active:      lang === 'hy' ? 'Ակտիվ' : 'Active',
    inactive:    lang === 'hy' ? 'Ոչ ակտիվ' : 'Inactive',
    fullName:    lang === 'hy' ? 'Անուն Ազգանուն' : 'Full Name',
    photoUrl:    lang === 'hy' ? 'Լուսանկարի հղում' : 'Photo URL',
    save:        lang === 'hy' ? 'Պահպանել' : 'Save Changes',
    saved:       lang === 'hy' ? 'Պահպանված է' : 'Saved!',
    seats:       lang === 'hy' ? 'տեղ մնացել' : 'seats left',
    rsvpBtn:     lang === 'hy' ? 'Գրանցվել' : 'RSVP',
    cancelRsvp:  lang === 'hy' ? 'Չեղարկել' : 'Cancel RSVP',
    booked:      lang === 'hy' ? 'Ամբողջությամբ ամրագրված' : 'Fully booked',
    noEvents:    lang === 'hy' ? 'Առայժմ հանդիպումներ չկան' : 'No upcoming events yet',
    noLibrary:   lang === 'hy' ? 'Գրադարանը դատարկ է' : 'Your library is empty',
    recipe:      lang === 'hy' ? 'Բաղադրատոմս' : 'Recipe',
    ebook:       lang === 'hy' ? 'Էլ. գիրք' : 'E-Book',
    download:    lang === 'hy' ? 'Բեռնել' : 'Download',
  }

  // Always re-fetch on mount to guarantee is_admin and other fields are fresh
  useEffect(() => {
    getMe().then(fresh => {
      setUser(fresh)
      setProfileForm({ full_name: fresh.full_name, photo_url: fresh.photo_url || '' })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (user) setProfileForm({ full_name: user.full_name, photo_url: user.photo_url || '' })
  }, [])

  useEffect(() => {
    if (tab === 'events') getEvents().then(setEvents).catch(() => {})
    if (tab === 'library') getLibrary().then(setLibrary).catch(() => {})
  }, [tab])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateMe(profileForm)
      setUser(updated)
      setMsg(t.saved)
      setTimeout(() => setMsg(''), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handleRsvp = async (event) => {
    try {
      if (event.user_has_rsvp) {
        await cancelRsvp(event.id)
      } else {
        await rsvp(event.id)
      }
      const updated = await getEvents()
      setEvents(updated)
    } catch {}
  }

  const handleSignOut = () => { signOut(); navigate('/') }

  if (!user) return null

  return (
    <div className="dash-page">
      <nav className="dash-nav">
        <div className="nav-logo">Hasmik's <span>Club</span></div>
        <div className="dash-nav-right">
          <span className="dash-user-name">{user.full_name}</span>
          {user.is_admin && (
            <Link to="/admin" className="nav-btn" style={{ background: 'var(--deep)', fontSize: '11px', padding: '8px 18px' }}>Admin</Link>
          )}
          <button className="dash-signout" onClick={handleSignOut}>{t.signOut}</button>
        </div>
      </nav>

      <div className="dash-body">
        <aside className="dash-sidebar">
          {TABS.map(k => (
            <button
              key={k}
              className={`dash-tab${tab === k ? ' active' : ''}`}
              onClick={() => setTab(k)}
            >
              {t[k]}
            </button>
          ))}
          {user.is_admin && (
            <Link to="/admin" className="dash-tab" style={{ color: 'var(--rose)', textDecoration: 'none', borderLeft: '3px solid var(--rose)' }}>
              Admin Panel
            </Link>
          )}
          <div className="dash-membership-badge">
            <span className={`dash-status ${user.membership_status}`}>
              {user.membership_status === 'active' ? t.active : t.inactive}
            </span>
          </div>
        </aside>

        <main className="dash-main">
          {tab === 'profile' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.welcome}, {user.full_name.split(' ')[0]}.</h2>
              <p className="dash-meta">
                {t.memberSince}: {new Date(user.joined_at).toLocaleDateString()}
                &nbsp;·&nbsp;
                {t.status}: <strong>{user.membership_status === 'active' ? t.active : t.inactive}</strong>
              </p>
              <form onSubmit={handleSave} className="profile-form">
                <label className="auth-label">{t.fullName}
                  <input className="auth-input" value={profileForm.full_name}
                    onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                </label>
                <label className="auth-label">{t.photoUrl}
                  <input className="auth-input" value={profileForm.photo_url}
                    onChange={e => setProfileForm(f => ({ ...f, photo_url: e.target.value }))} />
                </label>
                {profileForm.photo_url && (
                  <img src={profileForm.photo_url} alt="avatar" className="profile-avatar" />
                )}
                {msg && <p className="auth-success">{msg}</p>}
                <button className="btn-rose auth-submit" type="submit" disabled={saving}>
                  {saving ? '...' : t.save}
                </button>
              </form>
            </div>
          )}

          {tab === 'events' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.events}</h2>
              {events.length === 0
                ? <p className="dash-empty">{t.noEvents}</p>
                : events.map(ev => (
                  <div key={ev.id} className={`event-card${ev.user_has_rsvp ? ' rsvpd' : ''}`}>
                    <div className="event-card-top">
                      <div>
                        <div className="event-title">{lang === 'hy' && ev.title_hy ? ev.title_hy : ev.title}</div>
                        <div className="event-meta">
                          📍 {ev.location} &nbsp;·&nbsp;
                          🗓 {new Date(ev.event_date).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        {lang === 'hy' && ev.description_hy
                          ? <p className="event-desc">{ev.description_hy}</p>
                          : ev.description && <p className="event-desc">{ev.description}</p>}
                      </div>
                      <div className="event-seats">
                        {ev.seats_available > 0
                          ? <><strong>{ev.seats_available}</strong> {t.seats}</>
                          : <span className="fully-booked">{t.booked}</span>}
                      </div>
                    </div>
                    <button
                      className={`plan-btn ${ev.user_has_rsvp ? 'plan-btn-outline' : 'plan-btn-fill'}`}
                      onClick={() => handleRsvp(ev)}
                      disabled={!ev.user_has_rsvp && ev.seats_available === 0}
                    >
                      {ev.user_has_rsvp ? t.cancelRsvp : t.rsvpBtn}
                    </button>
                  </div>
                ))
              }
            </div>
          )}

          {tab === 'library' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.library}</h2>
              {library.length === 0
                ? <p className="dash-empty">{t.noLibrary}</p>
                : (
                  <div className="library-grid">
                    {library.map(item => (
                      <div key={item.id} className="library-card">
                        {item.cover_url && <img src={item.cover_url} alt={item.title} className="library-cover" />}
                        <div className="library-type">{item.type === 'recipe' ? t.recipe : t.ebook}</div>
                        <div className="library-title">{lang === 'hy' && item.title_hy ? item.title_hy : item.title}</div>
                        {(lang === 'hy' && item.description_hy ? item.description_hy : item.description) && (
                          <p className="library-desc">{lang === 'hy' && item.description_hy ? item.description_hy : item.description}</p>
                        )}
                        {item.file_url && (
                          <a href={item.file_url} target="_blank" rel="noreferrer" className="plan-btn plan-btn-fill library-dl">
                            {t.download}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
