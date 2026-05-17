import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMe, updateMe, uploadPhoto, getMemberDirectory } from '../api/members'
import { getEvents, rsvp, cancelRsvp, joinWaitlist, leaveWaitlist, getWaitlistPosition } from '../api/events'
import { getLibrary } from '../api/content'
import { getPublicSettings } from '../api/payments'
import { refreshToken as apiRefresh } from '../api/auth'
import NotificationBell from '../components/NotificationBell'
import client from '../api/client'

const TABS = ['profile', 'events', 'library', 'community']

export default function DashboardPage({ lang }) {
  const { user, setUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'profile')
  const [events, setEvents] = useState([])
  const [library, setLibrary] = useState([])
  const [directory, setDirectory] = useState([])
  const [waitlistPositions, setWaitlistPositions] = useState({}) // eventId -> {on_waitlist, position}
  const [profileForm, setProfileForm] = useState({ full_name: '', photo_url: '', show_in_directory: true })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [rsvpError, setRsvpError] = useState('')
  const [telegramUrl, setTelegramUrl] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [selectedContent, setSelectedContent] = useState(null)
  const fileInputRef = useRef(null)

  const closeContent = useCallback(() => setSelectedContent(null), [])
  useEffect(() => {
    if (!selectedContent) return
    const onKey = (e) => { if (e.key === 'Escape') closeContent() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedContent, closeContent])

  const t = {
    profile:     lang === 'hy' ? 'Պրոֆիլ' : 'Profile',
    events:      lang === 'hy' ? 'Հանդիպումներ' : 'Events',
    library:     lang === 'hy' ? 'Գրադարան' : 'Library',
    community:   lang === 'hy' ? 'Համայնք' : 'Community',
    signOut:     lang === 'hy' ? 'Ելք' : 'Sign Out',
    welcome:     lang === 'hy' ? 'Բարի գալուստ' : 'Welcome back',
    memberSince: lang === 'hy' ? 'Անդամ է' : 'Member since',
    status:      lang === 'hy' ? 'Կարգավիճակ' : 'Status',
    active:      lang === 'hy' ? 'Ակտիվ' : 'Active',
    inactive:    lang === 'hy' ? 'Ոչ ակտիվ' : 'Inactive',
    fullName:    lang === 'hy' ? 'Անուն Ազգանուն' : 'Full Name',
    uploadPhoto: lang === 'hy' ? 'Վերբեռնել լուսանկար' : 'Upload Photo',
    save:        lang === 'hy' ? 'Պահպանել' : 'Save Changes',
    saved:       lang === 'hy' ? 'Պահպանված է' : 'Saved!',
    showInDir:   lang === 'hy' ? 'Ցուցադրել համայնքի ցուցակում' : 'Show in community directory',
    seats:       lang === 'hy' ? 'տեղ մնացել' : 'seats left',
    rsvpBtn:     lang === 'hy' ? 'Գրանցվել' : 'RSVP',
    cancelRsvp:  lang === 'hy' ? 'Չեղարկել' : 'Cancel RSVP',
    booked:      lang === 'hy' ? 'Ամբողջությամբ ամրագրված' : 'Fully booked',
    waitlist:    lang === 'hy' ? 'Ցուցակ' : 'Join Waitlist',
    leaveWait:   lang === 'hy' ? 'Ցուցակից հեռացնել' : 'Leave Waitlist',
    waitPos:     lang === 'hy' ? 'Հերթ' : 'Waitlist position',
    noEvents:    lang === 'hy' ? 'Առայժմ հանդիպումներ չկան' : 'No upcoming events yet',
    noLibrary:   lang === 'hy' ? 'Ձեր գրադարանը դատարկ է' : 'Your library is empty',
    lockedLib:   lang === 'hy' ? 'Կողպված' : 'Locked',
    recipe:      lang === 'hy' ? 'Բաղադրատոմս' : 'Recipe',
    ebook:       lang === 'hy' ? 'Էլ. գիրք' : 'E-Book',
    download:    lang === 'hy' ? 'Բեռնել' : 'Download',
    joinTelegram:lang === 'hy' ? 'Միանալ Telegram խմբին' : 'Join our Telegram group',
    noMembers:   lang === 'hy' ? 'Անդամներ չկան ցուցակում' : 'No members in the directory yet',
    verifyBanner:lang === 'hy' ? 'Խնդրում ենք հաստատել Ձեր էլ. հասցեն' : 'Please verify your email address',
    resendVerify:lang === 'hy' ? 'Կրկին ուղարկել' : 'Resend verification email',
    verifyOk:    lang === 'hy' ? 'Էլ. հասցեն հաստատված է ✓' : 'Email verified ✓',
  }

  useEffect(() => {
    getMe().then(fresh => {
      setUser(fresh)
      setProfileForm({ full_name: fresh.full_name, photo_url: fresh.photo_url || '', show_in_directory: fresh.show_in_directory ?? true })
    }).catch(() => {})
    getPublicSettings().then(s => setTelegramUrl(s.telegram_invite_url || '')).catch(() => {})
  }, [])

  // handle ?verified=ok in URL
  useEffect(() => {
    const v = searchParams.get('verified')
    if (v === 'ok') { setMsg(t.verifyOk); getMe().then(fresh => { setUser(fresh) }) }
  }, [])

  useEffect(() => {
    if (tab === 'events') {
      getEvents().then(evs => {
        setEvents(evs)
        evs.filter(e => e.seats_available === 0 && !e.user_has_rsvp).forEach(e => {
          getWaitlistPosition(e.id).then(pos => setWaitlistPositions(p => ({ ...p, [e.id]: pos }))).catch(() => {})
        })
      }).catch(() => {})
    }
    if (tab === 'library') getLibrary().then(setLibrary).catch(() => {})
    if (tab === 'community') getMemberDirectory().then(setDirectory).catch(() => {})
  }, [tab])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateMe(profileForm)
      setUser(updated)
      setMsg(t.saved)
      setTimeout(() => setMsg(''), 2500)
    } finally { setSaving(false) }
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
    } catch { setMsg(lang === 'hy' ? 'Վերբեռնումը ձախողվեց' : 'Upload failed') }
    finally { setPhotoUploading(false) }
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

  const handleWaitlist = async (event) => {
    setRsvpError('')
    const pos = waitlistPositions[event.id]
    try {
      if (pos?.on_waitlist) {
        await leaveWaitlist(event.id)
        setWaitlistPositions(p => ({ ...p, [event.id]: { on_waitlist: false } }))
      } else {
        const result = await joinWaitlist(event.id)
        setWaitlistPositions(p => ({ ...p, [event.id]: { on_waitlist: true, position: result.position } }))
      }
    } catch (err) {
      const detail = err?.response?.data?.detail
      setRsvpError(detail || (lang === 'hy' ? 'Սխալ տեղի ունեցավ' : 'Something went wrong'))
    }
  }

  const handleResendVerify = async () => {
    try {
      await client.post('/auth/resend-verification')
      setMsg(lang === 'hy' ? 'Հաստատման նամակն ուղարկվել է' : 'Verification email sent!')
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg(lang === 'hy' ? 'Սխալ' : 'Error sending email') }
  }

  const handleSignOut = () => { signOut(); navigate('/') }

  if (!user) return null
  const isActive = user.membership_status === 'active'

  return (
    <div className="dash-page">
      <nav className="dash-nav">
        <div className="nav-logo">Hasmik's <span>Club</span></div>
        <div className="dash-nav-right">
          <NotificationBell />
          <span className="dash-user-name">{user.full_name}</span>
          {user.is_admin && (
            <Link to="/admin" className="nav-btn" style={{ background: 'var(--deep)', fontSize: '11px', padding: '8px 18px' }}>Admin</Link>
          )}
          <button className="dash-signout" onClick={handleSignOut}>{t.signOut}</button>
        </div>
      </nav>

      {/* Email verification banner */}
      {!user.is_verified && (
        <div style={{ background: '#fff8e1', borderBottom: '1px solid #ffe082', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#795548' }}>⚠️ {t.verifyBanner}</span>
          <button onClick={handleResendVerify} style={{ background: 'none', border: '1px solid #795548', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13, color: '#795548' }}>
            {t.resendVerify}
          </button>
        </div>
      )}

      <div className="dash-body">
        <aside className="dash-sidebar">
          {TABS.map(k => (
            <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
              {t[k]}
            </button>
          ))}
          {user.is_admin && (
            <Link to="/admin" className="dash-tab" style={{ color: 'var(--rose)', textDecoration: 'none', borderLeft: '3px solid var(--rose)' }}>
              Admin Panel
            </Link>
          )}
          <div className="dash-membership-badge">
            <span className={`dash-status ${user.membership_status}`}>{isActive ? t.active : t.inactive}</span>
          </div>
        </aside>

        <main className="dash-main">
          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.welcome}, {user.full_name.split(' ')[0]}.</h2>
              <p className="dash-meta">
                {t.memberSince}: {new Date(user.joined_at).toLocaleDateString()}
                &nbsp;·&nbsp;
                {t.status}: <strong>{isActive ? t.active : t.inactive}</strong>
              </p>

              {isActive && telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noreferrer" className="btn-rose auth-submit"
                  style={{ display: 'inline-block', textDecoration: 'none', marginBottom: '24px', maxWidth: '280px' }}>
                  ✈️ {t.joinTelegram}
                </a>
              )}

              {msg && <p className="auth-success" style={{ marginBottom: 16 }}>{msg}</p>}

              <form onSubmit={handleSave} className="profile-form">
                <label className="auth-label">{t.fullName}
                  <input className="auth-input" value={profileForm.full_name}
                    onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                </label>

                <div style={{ marginBottom: '16px' }}>
                  {profileForm.photo_url && <img src={profileForm.photo_url} alt="avatar" className="profile-avatar" />}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="plan-btn plan-btn-outline" style={{ fontSize: '13px', padding: '8px 16px' }}
                      onClick={() => fileInputRef.current?.click()} disabled={photoUploading}>
                      {photoUploading ? '...' : t.uploadPhoto}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                    <span style={{ fontSize: '12px', color: '#888' }}>{lang === 'hy' ? 'կամ հղում' : 'or URL'}</span>
                  </div>
                  <input className="auth-input" style={{ marginTop: '8px' }}
                    placeholder={lang === 'hy' ? 'Լուսանկարի հղում' : 'Photo URL (optional)'}
                    value={profileForm.photo_url}
                    onChange={e => setProfileForm(f => ({ ...f, photo_url: e.target.value }))} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer', fontSize: 14, color: '#555' }}>
                  <input type="checkbox" checked={profileForm.show_in_directory}
                    onChange={e => setProfileForm(f => ({ ...f, show_in_directory: e.target.checked }))} />
                  {t.showInDir}
                </label>

                <button className="btn-rose auth-submit" type="submit" disabled={saving}>
                  {saving ? '...' : t.save}
                </button>
              </form>
            </div>
          )}

          {/* ── EVENTS ── */}
          {tab === 'events' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.events}</h2>
              {rsvpError && <p className="auth-error" style={{ marginBottom: '12px' }}>{rsvpError}</p>}
              {events.length === 0
                ? <p className="dash-empty">{t.noEvents}</p>
                : events.map(ev => {
                  const wl = waitlistPositions[ev.id]
                  return (
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

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {ev.user_has_rsvp ? (
                          <button className="plan-btn plan-btn-outline" onClick={() => handleRsvp(ev)}>{t.cancelRsvp}</button>
                        ) : ev.seats_available > 0 ? (
                          <button className="plan-btn plan-btn-fill" onClick={() => handleRsvp(ev)}>{t.rsvpBtn}</button>
                        ) : (
                          <button
                            className={`plan-btn ${wl?.on_waitlist ? 'plan-btn-outline' : 'plan-btn-fill'}`}
                            style={{ background: wl?.on_waitlist ? undefined : '#f39c12', borderColor: '#f39c12', color: wl?.on_waitlist ? '#f39c12' : '#fff' }}
                            onClick={() => handleWaitlist(ev)}
                          >
                            {wl?.on_waitlist ? t.leaveWait : t.waitlist}
                          </button>
                        )}
                        {wl?.on_waitlist && (
                          <span style={{ fontSize: 13, color: '#f39c12', fontWeight: 600 }}>
                            #{wl.position} {t.waitPos}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              }
            </div>
          )}

          {/* ── LIBRARY ── */}
          {tab === 'library' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{t.library}</h2>
              {library.length === 0
                ? <p className="dash-empty">{t.noLibrary}</p>
                : (
                  <div className="library-grid">
                    {library.map(item => (
                      <div key={item.id} className="library-card" style={{ opacity: item.is_unlocked ? 1 : 0.6, cursor: 'pointer' }}
                        onClick={() => setSelectedContent(item)}>
                        {item.cover_url && <img src={item.cover_url} alt={item.title} className="library-cover" />}
                        <div className="library-type">{item.type === 'recipe' ? t.recipe : t.ebook}</div>
                        <div className="library-title">{lang === 'hy' && item.title_hy ? item.title_hy : item.title}</div>
                        {(lang === 'hy' && item.description_hy ? item.description_hy : item.description) && (
                          <p className="library-desc">{lang === 'hy' && item.description_hy ? item.description_hy : item.description}</p>
                        )}
                        {item.is_unlocked && item.file_url
                          ? <span className="plan-btn plan-btn-fill library-dl">{t.download}</span>
                          : <span style={{ fontSize: 13, color: '#aaa', marginTop: 'auto' }}>🔒 {t.lockedLib}</span>
                        }
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ── COMMUNITY ── */}
          {tab === 'community' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{lang === 'hy' ? 'Մեր Անդամները' : 'Our Members'}</h2>
              <p style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>
                {lang === 'hy' ? 'Ծանոթացեք Hasmik\'s Club-ի ակտիվ անդամների հետ' : "Meet the active members of Hasmik's Club"}
              </p>
              {directory.length === 0
                ? <p className="dash-empty">{t.noMembers}</p>
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 20 }}>
                    {directory.map(m => (
                      <div key={m.id} style={{ textAlign: 'center', background: '#fff', borderRadius: 14, padding: '24px 16px', boxShadow: '0 2px 10px rgba(192,57,75,.07)' }}>
                        {m.photo_url
                          ? <img src={m.photo_url} alt={m.full_name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 12, border: '3px solid #f5c0c0' }} />
                          : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f5c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px', color: '#c0394b', fontWeight: 700 }}>
                              {m.full_name.charAt(0)}
                            </div>
                        }
                        <div style={{ fontWeight: 600, color: '#2c1a1a', fontSize: 14 }}>{m.full_name}</div>
                        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                          {lang === 'hy' ? 'Անդամ' : 'Member'} {new Date(m.joined_at).getFullYear()}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </main>
      </div>

      {/* ── Content viewer modal ── */}
      {selectedContent && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(44,26,26,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={closeContent}
        >
          <div
            style={{ background: 'var(--linen)', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '90vh', overflow: 'auto', position: 'relative', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={closeContent}
              style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: '#999', lineHeight: 1, zIndex: 1 }}
              aria-label="Close"
            >×</button>

            {selectedContent.cover_url && (
              <img src={selectedContent.cover_url} alt={selectedContent.title}
                style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: '16px 16px 0 0', display: 'block' }} />
            )}

            <div style={{ padding: '28px 32px 32px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                {selectedContent.type === 'recipe' ? t.recipe : t.ebook}
              </div>
              <h2 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 26, fontWeight: 700, color: 'var(--deep)', margin: '0 0 14px', lineHeight: 1.25 }}>
                {lang === 'hy' && selectedContent.title_hy ? selectedContent.title_hy : selectedContent.title}
              </h2>
              {(lang === 'hy' && selectedContent.description_hy ? selectedContent.description_hy : selectedContent.description) && (
                <p style={{ color: 'var(--taupe)', fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>
                  {lang === 'hy' && selectedContent.description_hy ? selectedContent.description_hy : selectedContent.description}
                </p>
              )}

              {selectedContent.is_unlocked && selectedContent.file_url ? (
                <>
                  {selectedContent.file_url.toLowerCase().endsWith('.pdf') && (
                    <iframe
                      src={selectedContent.file_url}
                      title={selectedContent.title}
                      style={{ width: '100%', height: 380, border: '1px solid var(--sand)', borderRadius: 8, marginBottom: 16, display: 'block' }}
                    />
                  )}
                  <a href={selectedContent.file_url} target="_blank" rel="noreferrer"
                    className="plan-btn plan-btn-fill"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                    {t.download}
                  </a>
                </>
              ) : (
                <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 8 }}>🔒 {t.lockedLib}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
