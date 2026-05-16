import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  adminGetMembers, adminUpdateMember, adminDeleteMember,
  adminGetEvents, adminGetEventAttendees, adminCreateEvent, adminUpdateEvent, adminDeleteEvent,
  adminGetContent, adminCreateContent, adminUpdateContent, adminDeleteContent,
  adminUnlockContent, adminUnlockContentForAll, adminGetStats,
} from '../api/admin'

const TABS = ['members', 'events', 'content', 'stats']

const EMPTY_EVENT = { title: '', title_hy: '', description: '', description_hy: '', location: '', event_date: '', max_seats: 20 }
const EMPTY_CONTENT = { type: 'recipe', title: '', title_hy: '', description: '', description_hy: '', file_url: '', cover_url: '' }

export default function AdminPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('members')

  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [content, setContent] = useState([])
  const [stats, setStats] = useState(null)
  const [attendees, setAttendees] = useState({}) // eventId -> [user]

  const [eventForm, setEventForm] = useState(EMPTY_EVENT)
  const [editingEvent, setEditingEvent] = useState(null)
  const [contentForm, setContentForm] = useState(EMPTY_CONTENT)
  const [editingContent, setEditingContent] = useState(null)
  const [unlockTarget, setUnlockTarget] = useState({ contentId: '', userId: '' })

  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const flash = (m, isErr = false) => {
    isErr ? setErr(m) : setMsg(m)
    setTimeout(() => { setMsg(''); setErr('') }, 3000)
  }

  useEffect(() => { if (tab === 'members') load('members') }, [tab])
  useEffect(() => { if (tab === 'events') load('events') }, [tab])
  useEffect(() => { if (tab === 'content') load('content') }, [tab])
  useEffect(() => { if (tab === 'stats') load('stats') }, [tab])

  const load = async (t) => {
    try {
      if (t === 'members') setMembers(await adminGetMembers())
      if (t === 'events') setEvents(await adminGetEvents())
      if (t === 'content') setContent(await adminGetContent())
      if (t === 'stats') setStats(await adminGetStats())
    } catch { flash('Failed to load', true) }
  }

  // ── members ──
  const toggleMembership = async (m) => {
    const next = m.membership_status === 'active' ? 'inactive' : 'active'
    await adminUpdateMember(m.id, { membership_status: next })
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, membership_status: next } : x))
    flash(`${m.full_name} set to ${next}`)
  }
  const toggleAdmin = async (m) => {
    await adminUpdateMember(m.id, { is_admin: !m.is_admin })
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, is_admin: !m.is_admin } : x))
    flash(`${m.full_name} admin: ${!m.is_admin}`)
  }
  const deleteMember = async (m) => {
    if (!confirm(`Delete ${m.full_name}?`)) return
    await adminDeleteMember(m.id)
    setMembers(ms => ms.filter(x => x.id !== m.id))
    flash('Member deleted')
  }

  // ── events ──
  const setEF = k => e => setEventForm(f => ({ ...f, [k]: e.target.value }))
  const submitEvent = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...eventForm, max_seats: Number(eventForm.max_seats) }
      if (editingEvent) {
        const updated = await adminUpdateEvent(editingEvent.id, payload)
        setEvents(es => es.map(x => x.id === editingEvent.id ? updated : x))
        flash('Event updated')
      } else {
        const created = await adminCreateEvent(payload)
        setEvents(es => [created, ...es])
        flash('Event created')
      }
      setEventForm(EMPTY_EVENT)
      setEditingEvent(null)
    } catch { flash('Failed to save event', true) }
  }
  const startEditEvent = (ev) => {
    setEditingEvent(ev)
    setEventForm({
      title: ev.title || '', title_hy: ev.title_hy || '',
      description: ev.description || '', description_hy: ev.description_hy || '',
      location: ev.location || '',
      event_date: ev.event_date ? ev.event_date.slice(0, 16) : '',
      max_seats: ev.max_seats,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const deleteEvent = async (ev) => {
    if (!confirm(`Delete "${ev.title}"?`)) return
    await adminDeleteEvent(ev.id)
    setEvents(es => es.filter(x => x.id !== ev.id))
    flash('Event deleted')
  }
  const toggleAttendees = async (evId) => {
    if (attendees[evId]) {
      setAttendees(a => { const n = { ...a }; delete n[evId]; return n })
      return
    }
    try {
      const list = await adminGetEventAttendees(evId)
      setAttendees(a => ({ ...a, [evId]: list }))
    } catch { flash('Failed to load attendees', true) }
  }

  // ── content ──
  const setCF = k => e => setContentForm(f => ({ ...f, [k]: e.target.value }))
  const submitContent = async (e) => {
    e.preventDefault()
    try {
      if (editingContent) {
        const updated = await adminUpdateContent(editingContent.id, contentForm)
        setContent(cs => cs.map(x => x.id === editingContent.id ? updated : x))
        flash('Content updated')
      } else {
        const created = await adminCreateContent(contentForm)
        setContent(cs => [created, ...cs])
        flash('Content created')
      }
      setContentForm(EMPTY_CONTENT)
      setEditingContent(null)
    } catch { flash('Failed to save content', true) }
  }
  const startEditContent = (item) => {
    setEditingContent(item)
    setContentForm({
      type: item.type, title: item.title || '', title_hy: item.title_hy || '',
      description: item.description || '', description_hy: item.description_hy || '',
      file_url: item.file_url || '', cover_url: item.cover_url || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const deleteContent = async (item) => {
    if (!confirm(`Delete "${item.title}"?`)) return
    await adminDeleteContent(item.id)
    setContent(cs => cs.filter(x => x.id !== item.id))
    flash('Content deleted')
  }
  const handleUnlock = async (e) => {
    e.preventDefault()
    try {
      await adminUnlockContent(unlockTarget.contentId, unlockTarget.userId)
      flash(`Content unlocked for user #${unlockTarget.userId}`)
      setUnlockTarget({ contentId: '', userId: '' })
    } catch { flash('Failed to unlock', true) }
  }
  const handleUnlockAll = async (item) => {
    if (!confirm(`Unlock "${item.title}" for ALL active members?`)) return
    try {
      await adminUnlockContentForAll(item.id)
      flash(`"${item.title}" unlocked for all active members`)
    } catch { flash('Failed to unlock', true) }
  }

  return (
    <div className="dash-page">
      <nav className="dash-nav">
        <div className="nav-logo">Hasmik's <span>Club</span> <span className="admin-badge">Admin</span></div>
        <div className="dash-nav-right">
          <span className="dash-user-name">{user?.full_name}</span>
          <button className="dash-signout" onClick={() => { signOut(); navigate('/') }}>Sign Out</button>
        </div>
      </nav>

      <div className="dash-body">
        <aside className="dash-sidebar">
          {TABS.map(k => (
            <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
          <div style={{ padding: '24px 32px', marginTop: 'auto' }}>
            <button className="dash-signout" style={{ width: '100%' }} onClick={() => navigate('/dashboard')}>
              ← Member View
            </button>
          </div>
        </aside>

        <main className="dash-main">
          {msg && <div className="admin-flash success">{msg}</div>}
          {err && <div className="admin-flash error">{err}</div>}

          {/* ── MEMBERS ── */}
          {tab === 'members' && (
            <div className="dash-section">
              <h2 className="dash-section-title">Members <span className="admin-count">{members.length}</span></h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Email</th><th>Status</th><th>Joined</th><th>Admin</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id}>
                        <td>{m.full_name}</td>
                        <td className="admin-td-muted">{m.email}</td>
                        <td>
                          <span className={`status-pill ${m.membership_status}`}>{m.membership_status}</span>
                        </td>
                        <td className="admin-td-muted">{new Date(m.joined_at).toLocaleDateString()}</td>
                        <td>
                          <input type="checkbox" checked={m.is_admin} onChange={() => toggleAdmin(m)} />
                        </td>
                        <td className="admin-actions">
                          <button className="admin-btn-sm toggle" onClick={() => toggleMembership(m)}>
                            {m.membership_status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="admin-btn-sm danger" onClick={() => deleteMember(m)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── EVENTS ── */}
          {tab === 'events' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{editingEvent ? 'Edit Event' : 'Create Event'}</h2>
              <form onSubmit={submitEvent} className="admin-form">
                <div className="admin-form-grid">
                  <label className="auth-label">Title (EN)<input className="auth-input" value={eventForm.title} onChange={setEF('title')} required /></label>
                  <label className="auth-label">Title (ՀԱՅ)<input className="auth-input" value={eventForm.title_hy} onChange={setEF('title_hy')} /></label>
                  <label className="auth-label">Location<input className="auth-input" value={eventForm.location} onChange={setEF('location')} required /></label>
                  <label className="auth-label">Date & Time<input className="auth-input" type="datetime-local" value={eventForm.event_date} onChange={setEF('event_date')} required /></label>
                  <label className="auth-label">Max Seats<input className="auth-input" type="number" value={eventForm.max_seats} onChange={setEF('max_seats')} min={1} required /></label>
                </div>
                <label className="auth-label">Description (EN)<textarea className="auth-input admin-textarea" value={eventForm.description} onChange={setEF('description')} /></label>
                <label className="auth-label">Description (ՀԱՅ)<textarea className="auth-input admin-textarea" value={eventForm.description_hy} onChange={setEF('description_hy')} /></label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-rose auth-submit" type="submit" style={{ width: 'auto', padding: '12px 32px' }}>
                    {editingEvent ? 'Update Event' : 'Create Event'}
                  </button>
                  {editingEvent && (
                    <button type="button" className="admin-btn-sm" onClick={() => { setEditingEvent(null); setEventForm(EMPTY_EVENT) }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <h2 className="dash-section-title" style={{ marginTop: 48 }}>All Events <span className="admin-count">{events.length}</span></h2>
              {events.length === 0 ? <p className="dash-empty">No events yet.</p> : events.map(ev => (
                <div key={ev.id} className="event-card">
                  <div className="event-card-top">
                    <div>
                      <div className="event-title">{ev.title}</div>
                      <div className="event-meta">📍 {ev.location} · 🗓 {new Date(ev.event_date).toLocaleString()} · 👥 {ev.seats_taken}/{ev.max_seats} RSVPs</div>
                    </div>
                    <div className="admin-actions">
                      <button className="admin-btn-sm" onClick={() => toggleAttendees(ev.id)}>
                        {attendees[ev.id] ? 'Hide' : 'Attendees'}
                      </button>
                      <button className="admin-btn-sm toggle" onClick={() => startEditEvent(ev)}>Edit</button>
                      <button className="admin-btn-sm danger" onClick={() => deleteEvent(ev)}>Delete</button>
                    </div>
                  </div>
                  {attendees[ev.id] && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0e0e5' }}>
                      {attendees[ev.id].length === 0
                        ? <p style={{ color: '#888', fontSize: '13px' }}>No RSVPs yet.</p>
                        : (
                          <table className="admin-table" style={{ fontSize: '13px' }}>
                            <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
                            <tbody>
                              {attendees[ev.id].map(a => (
                                <tr key={a.id}>
                                  <td>{a.full_name}</td>
                                  <td className="admin-td-muted">{a.email}</td>
                                  <td><span className={`status-pill ${a.membership_status}`}>{a.membership_status}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── CONTENT ── */}
          {tab === 'content' && (
            <div className="dash-section">
              <h2 className="dash-section-title">{editingContent ? 'Edit Content' : 'Add Content'}</h2>
              <form onSubmit={submitContent} className="admin-form">
                <div className="admin-form-grid">
                  <label className="auth-label">Type
                    <select className="auth-input" value={contentForm.type} onChange={setCF('type')}>
                      <option value="recipe">Recipe</option>
                      <option value="ebook">E-Book</option>
                    </select>
                  </label>
                  <label className="auth-label">Title (EN)<input className="auth-input" value={contentForm.title} onChange={setCF('title')} required /></label>
                  <label className="auth-label">Title (ՀԱՅ)<input className="auth-input" value={contentForm.title_hy} onChange={setCF('title_hy')} /></label>
                  <label className="auth-label">File URL<input className="auth-input" value={contentForm.file_url} onChange={setCF('file_url')} placeholder="https://..." /></label>
                  <label className="auth-label">Cover Image URL<input className="auth-input" value={contentForm.cover_url} onChange={setCF('cover_url')} placeholder="https://..." /></label>
                </div>
                <label className="auth-label">Description (EN)<textarea className="auth-input admin-textarea" value={contentForm.description} onChange={setCF('description')} /></label>
                <label className="auth-label">Description (ՀԱՅ)<textarea className="auth-input admin-textarea" value={contentForm.description_hy} onChange={setCF('description_hy')} /></label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-rose auth-submit" type="submit" style={{ width: 'auto', padding: '12px 32px' }}>
                    {editingContent ? 'Update' : 'Add Content'}
                  </button>
                  {editingContent && (
                    <button type="button" className="admin-btn-sm" onClick={() => { setEditingContent(null); setContentForm(EMPTY_CONTENT) }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <h2 className="dash-section-title" style={{ marginTop: 48 }}>Unlock for Specific Member</h2>
              <form onSubmit={handleUnlock} className="admin-form" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                <label className="auth-label" style={{ flex: 1 }}>Content ID
                  <input className="auth-input" type="number" value={unlockTarget.contentId} onChange={e => setUnlockTarget(u => ({ ...u, contentId: e.target.value }))} required />
                </label>
                <label className="auth-label" style={{ flex: 1 }}>User ID
                  <input className="auth-input" type="number" value={unlockTarget.userId} onChange={e => setUnlockTarget(u => ({ ...u, userId: e.target.value }))} required />
                </label>
                <button className="admin-btn-sm toggle" type="submit" style={{ marginBottom: 1 }}>Unlock</button>
              </form>

              <h2 className="dash-section-title" style={{ marginTop: 48 }}>All Content <span className="admin-count">{content.length}</span></h2>
              {content.length === 0 ? <p className="dash-empty">No content yet.</p> : (
                <div className="library-grid">
                  {content.map(item => (
                    <div key={item.id} className="library-card">
                      {item.cover_url && <img src={item.cover_url} alt={item.title} className="library-cover" />}
                      <div className="library-type">{item.type} · #{item.id}</div>
                      <div className="library-title">{item.title}</div>
                      {item.description && <p className="library-desc">{item.description}</p>}
                      <div className="admin-actions" style={{ marginTop: 'auto', flexWrap: 'wrap' }}>
                        <button className="admin-btn-sm toggle" onClick={() => startEditContent(item)}>Edit</button>
                        <button className="admin-btn-sm" onClick={() => handleUnlockAll(item)} title="Unlock for all active members">Unlock All</button>
                        <button className="admin-btn-sm danger" onClick={() => deleteContent(item)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STATS ── */}
          {tab === 'stats' && (
            <div className="dash-section">
              <h2 className="dash-section-title">Overview</h2>
              {!stats ? <p className="dash-empty">Loading...</p> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '40px' }}>
                    {[
                      { label: 'Total Members', value: stats.total_members },
                      { label: 'Active Members', value: stats.active_members, color: '#2ecc71' },
                      { label: 'Inactive Members', value: stats.inactive_members, color: '#e74c3c' },
                      { label: 'Total Events', value: stats.total_events },
                      { label: 'Total RSVPs', value: stats.total_rsvps },
                      { label: 'Content Items', value: stats.total_content },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: 700, color: color || 'var(--deep)' }}>{value}</div>
                        <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <h2 className="dash-section-title">Events & RSVPs</h2>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr><th>Event</th><th>Date</th><th>Seats</th><th>RSVPs</th><th>Fill %</th></tr>
                      </thead>
                      <tbody>
                        {stats.events.map(ev => (
                          <tr key={ev.id}>
                            <td>{ev.title}</td>
                            <td className="admin-td-muted">{new Date(ev.event_date).toLocaleDateString()}</td>
                            <td>{ev.max_seats}</td>
                            <td>{ev.rsvp_count}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, background: '#f0e0e5', borderRadius: '4px', height: '6px' }}>
                                  <div style={{ width: `${Math.round(ev.rsvp_count / ev.max_seats * 100)}%`, background: 'var(--rose)', borderRadius: '4px', height: '6px' }} />
                                </div>
                                <span style={{ fontSize: '12px', color: '#666' }}>{Math.round(ev.rsvp_count / ev.max_seats * 100)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
