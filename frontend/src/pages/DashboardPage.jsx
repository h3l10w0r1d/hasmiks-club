import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMe, updateMe, uploadPhoto } from '../api/members'
import { getEvents, rsvp, cancelRsvp } from '../api/events'
import { getLibrary } from '../api/content'
import { getPublicSettings } from '../api/payments'

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
  const [rsvpError, setRsvpError] = useState('')
  const [telegramUrl, setTelegramUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef(null)

  const t = {
    profile:        lang === 'hy' ? 'Պրոֆիլ' : 'Profile',
    events:         lang === 'hy' ? 'Հանդիպումներ' : 'Events',
    library:        lang === 'hy' ? 'Գրադարան' : 'Library',
    signOut:        lang === 'hy' ? 'Ելք' : 'Sign Out',
    welcome:        lang === 'hy' ? 'Բարի գալուստ' : 'Welcome back',
    memberSince:    lang === 'hy' ? 'Անդամ է' : 'Member since',
    status:         lang === 'hy' ? 'Կարգավիճակ' : 'Status',
    active:         lang === 'hy' ? 'Ակտիվ' : 'Active',
    inactive:       lang === 'hy' ? 'Ոչ ակտիվ' : 'Inactive',
    fullName:       lang === 'hy' ? 'Անուն Ազգանուն' : 'Full Name',
    photoUrl:       lang === 'hy' ? 'Լուսանկարի հղում' : 'Photo URL',
    uploadPhoto:    lang === 'hy' ? 'Վերբեռնել լուսանկար' : 'Upload Photo',
    save:           lang === 'hy' ? 'Պահպանել' : 'Save Changes',
    saved:          lang === 'hy' ? 'Պահպանված է' : 'Saved!',
    seats:          lang === 'hy' ? 'տեղ մնացել' : 'seats left',
    rsvpBtn:        lang === 'hy' ? 'Գրանցվել' : 'RSVP',
    cancelRsvp:     lang === 'hy' ? 'Չեղարկել' : 'Cancel RSVP',
    booked:         lang === 'hy' ? 'Ամբողջությամբ ամրագրված' : 'Fully booked',
    noEvents:       lang === 'hy' ? 'Առայժմ հանդիպումներ չկան' : 'No upcoming events yet',
    noLibrary:      lang === 'hy' ? 'Գրադարանը դատարկ է' : 'Your library is empty',
    recipe:         lang === 'hy' ? 'Բաղադրատոմս' : 'Recipe',
    ebook:          lang === 'hy' ? 'Էլ. գիրք' : 'E-Book',
    download:       lang === 'hy' ? 'Բեռնել' : 'Download',
    joinTelegram:   lang === 'hy' ? 'Միանալ Telegram խմբին' : 'Join our Telegram group',
  }

  useEffect(() => {
    getMe().then(fresh => {
      setUser(fresh)
      setProfileForm({ full_name: fresh.full_name, photo_url: fresh.photo_url || '' })
    }).catch(() => {})
    getPublicSettings().then(s => {
      setTelegramUrl(s.telegram_invite_url || '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'events') getEvents().then(setEvents).catch(() => {})
    if (tab === 'library') getLibrary().then(setLibrary).catch(() => {})
  }, [tab])

  // Show payment=success notice
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      setMsg(lang === 'hy' ? 'Վճարումը հաջողված է! Անդամությունը կակտիվանա մի քանի րոպեի ընթացքում:' : 'Payment successful! Your membership will activate shortly.')
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const updated = await uploadPhoto(file)
      setUser(updated)
      setProfileForm(f => ({ ...f, photo_url: updated.photo_url || '' }))
      setMsg(lang === 'hy' ? 'Լուսանկարը պահպանված է' : 'Photo updated!')
      setTimeout(() => setMsg(''), 2500)
    } catch {
      setMsg(lang === 'hy' ? 'Լուսանկարի վերբեռնումը ձախողվեց' : 'Photo upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleRsvp = async (event) => {
    setRsvpError('')
    try {
      if (event.user_has_rsvp) {
        await cancelRsvp(event.id)
      } else {
        await rsvp(event.id)
      }
      const updated = await getEvents()
      setEvents(updated)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setRsvpError(detail || (lang === 'hy' ? 'Սխալ տեղի ունեցավ' : 'Something went wrong'))
    }
  }

  const handleSignOut = () => { signOut(); navigate('/') }

  if (!user) return null

  const isActive = user.membership_status === 'active'

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
              {isActive ? t.active : t.inactive}
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
                {t.status}: <strong>{isActive ? t.active : t.inactive}</strong>
              </p>

              {/* Telegram group — only for active members */}
              {isActive && telegramUrl && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-rose auth-submit"
                  style={{ display: 'inline-block', textDecoration: 'none', marginBottom: '24px', maxWidth: '280px' }}
                >
                  ✈️ {t.joinTelegram}
                </a>
              )}

              {msg && <p className="auth-success">{msg}</p>}

              <form onSubmit={handleSave} className="profile-form">
                <label className="auth-label">{t.fullName}
                  <input className="auth-input" value={profileForm.full_name}
                    onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                </label>

                {/* Photo section */}
                <div style={{ marginBottom: '16px' }}>
                  {profileForm.photo_url && (
                    <img src={profileForm.photo_url} alt="avatar" className="profile-avatar" />
                  )}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="plan-btn plan-btn-outline"
                      style={{ fontSize: '13px', padding: '8px 16px' }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoUploading}
                    >
                      {photoUploading ? '...' : t.uploadPhoto}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                    />
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {lang === 'hy' ? 'կամ մուտքագրեք հղում' : 'or enter a URL'}
                    </span>
                  </div>
                  <input
                    className="auth-input"
                    style={{ marginTop: '8px' }}
                    placeholder={lang === 'hy' ? 'Լուսանկարի հղում (URL)' : 'Photo URL (optional)'}
                    value={profileForm.photo_url}
                    onChange={e => setProfileForm(f => ({ ...f, photo_url: e.target.value }))}
                  />
                </div>

                <button className="btn-rose auth-submit" type="submit" disabled={saving}>
                  {saving ? '...' : t.save}
                </button>
              </form>
            </div>
          )}

          {tab === 'events' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.events}</h2>
              {rsvpError && <p className="auth-error" style={{ marginBottom: '12px' }}>{rsvpError}</p>}
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
