import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  adminGetMembers, adminUpdateMember, adminDeleteMember,
  adminGetEvents, adminGetEventAttendees, adminCreateEvent, adminUpdateEvent, adminDeleteEvent,
  adminGetContent, adminCreateContent, adminUpdateContent, adminDeleteContent,
  adminUnlockContent, adminUnlockContentForAll,
  adminBroadcast, adminExportCsv, adminGetAuditLog,
} from '../api/admin'

import AnalyticsDashboard from '../components/AnalyticsDashboard'

const TAB_CONFIG = [
  { key: 'members',   icon: '👥', label: 'Members'   },
  { key: 'events',    icon: '🗓', label: 'Events'    },
  { key: 'content',   icon: '📚', label: 'Content'   },
  { key: 'analytics', icon: '📊', label: 'Analytics' },
  { key: 'broadcast', icon: '📨', label: 'Broadcast' },
  { key: 'audit',     icon: '🔍', label: 'Audit Log' },
]

const EMPTY_EVENT   = { title: '', title_hy: '', description: '', description_hy: '', location: '', event_date: '', max_seats: 20 }
const EMPTY_CONTENT = { type: 'recipe', title: '', title_hy: '', description: '', description_hy: '', file_url: '', cover_url: '' }

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function actionChipClass(action = '') {
  if (action.includes('create')) return 'create'
  if (action.includes('delete')) return 'delete'
  if (action.includes('update') || action.includes('broadcast') || action.includes('unlock') || action.includes('export')) return 'update'
  return 'other'
}

export default function AdminPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('members')

  const [members,   setMembers]   = useState([])
  const [events,    setEvents]    = useState([])
  const [content,   setContent]   = useState([])
  const [attendees, setAttendees] = useState({})
  const [auditLog,  setAuditLog]  = useState([])

  const [eventForm,      setEventForm]      = useState(EMPTY_EVENT)
  const [editingEvent,   setEditingEvent]   = useState(null)
  const [contentForm,    setContentForm]    = useState(EMPTY_CONTENT)
  const [editingContent, setEditingContent] = useState(null)
  const [unlockTarget,   setUnlockTarget]   = useState({ contentId: '', userId: '' })

  const [broadcastForm, setBroadcastForm] = useState({ subject: '', body: '', segment: 'all' })
  const [broadcasting,  setBroadcasting]  = useState(false)

  const [toast, setToast] = useState(null) // { msg, type }

  const flash = (msg, isErr = false) => {
    setToast({ msg, type: isErr ? 'error' : 'success' })
    setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => { if (tab === 'members')   load('members')   }, [tab])
  useEffect(() => { if (tab === 'events')    load('events')    }, [tab])
  useEffect(() => { if (tab === 'content')   load('content')   }, [tab])
  useEffect(() => { if (tab === 'audit')     load('audit')     }, [tab])

  const load = async (t) => {
    try {
      if (t === 'members') setMembers(await adminGetMembers())
      if (t === 'events')  setEvents(await adminGetEvents())
      if (t === 'content') setContent(await adminGetContent())
      if (t === 'audit')   setAuditLog(await adminGetAuditLog())
    } catch { flash('Failed to load data', true) }
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
    flash(`${m.full_name} admin → ${!m.is_admin}`)
  }
  const deleteMember = async (m) => {
    if (!confirm(`Delete ${m.full_name}? This cannot be undone.`)) return
    await adminDeleteMember(m.id)
    setMembers(ms => ms.filter(x => x.id !== m.id))
    flash('Member deleted')
  }
  const handleExportCsv = async () => {
    try {
      const blob = await adminExportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { flash('Export failed', true) }
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
      setEventForm(EMPTY_EVENT); setEditingEvent(null)
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
      setContentForm(EMPTY_CONTENT); setEditingContent(null)
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
      flash(`Content #${unlockTarget.contentId} unlocked for user #${unlockTarget.userId}`)
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

  // ── broadcast ──
  const handleBroadcast = async (e) => {
    e.preventDefault()
    if (!confirm(`Send email to "${broadcastForm.segment}" segment?`)) return
    setBroadcasting(true)
    try {
      const res = await adminBroadcast(broadcastForm)
      flash(`Sent to ${res.sent_to} recipient${res.sent_to !== 1 ? 's' : ''}`)
      setBroadcastForm({ subject: '', body: '', segment: 'all' })
    } catch { flash('Broadcast failed', true) }
    finally { setBroadcasting(false) }
  }

  // derived stats
  const activeCount   = members.filter(m => m.membership_status === 'active').length
  const inactiveCount = members.filter(m => m.membership_status !== 'active').length
  const upcomingCount = events.filter(ev => new Date(ev.event_date) > new Date()).length
  const totalRsvps    = events.reduce((s, ev) => s + (ev.seats_taken || 0), 0)

  const currentTab = TAB_CONFIG.find(t => t.key === tab)

  return (
    <div className="admin-shell">

      {/* ── sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          Hasmik's <span>Club</span>
          <small>Admin Panel</small>
        </div>

        <nav className="admin-sidebar-nav">
          {TAB_CONFIG.map(t => (
            <button
              key={t.key}
              className={`admin-sidebar-item${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className="si-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">{initials(user?.full_name)}</div>
            <span className="admin-sidebar-name">{user?.full_name}</span>
          </div>
          <button className="admin-sidebar-back" onClick={() => navigate('/dashboard')}>
            ← Member view
          </button>
          <button className="admin-sidebar-signout" onClick={() => { signOut(); navigate('/') }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── main body ── */}
      <div className="admin-body">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            Admin&nbsp;/&nbsp;<strong>{currentTab?.label}</strong>
          </div>
        </header>

        <main className="admin-main">

          {/* toast */}
          {toast && (
            <div className={`admin-toast ${toast.type}`}>{toast.msg}</div>
          )}

          {/* ══════════ MEMBERS ══════════ */}
          {tab === 'members' && (
            <>
              <div className="admin-page-hd">
                <div className="admin-page-title">
                  Members
                  <small>Manage all registered members</small>
                </div>
                <div className="admin-page-actions">
                  <button className="admin-btn-sm" onClick={handleExportCsv}>⬇ Export CSV</button>
                </div>
              </div>

              <div className="admin-kpi-row">
                <div className="admin-kpi">
                  <div className="admin-kpi-val">{members.length}</div>
                  <div className="admin-kpi-lbl">Total Members</div>
                </div>
                <div className="admin-kpi">
                  <div className="admin-kpi-val green">{activeCount}</div>
                  <div className="admin-kpi-lbl">Active</div>
                </div>
                <div className="admin-kpi">
                  <div className="admin-kpi-val">{inactiveCount}</div>
                  <div className="admin-kpi-lbl">Inactive</div>
                </div>
                <div className="admin-kpi">
                  <div className="admin-kpi-val rose">
                    {members.length ? Math.round(activeCount / members.length * 100) : 0}%
                  </div>
                  <div className="admin-kpi-lbl">Activation Rate</div>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Admin</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0
                        ? <tr><td colSpan={6} style={{ textAlign: 'center', color: '#aaa', padding: 24 }}>No members yet</td></tr>
                        : members.map(m => (
                          <tr key={m.id}>
                            <td>
                              <span className="admin-avatar">{initials(m.full_name)}</span>
                              {m.full_name}
                            </td>
                            <td className="admin-td-muted">{m.email}</td>
                            <td><span className={`status-pill ${m.membership_status}`}>{m.membership_status}</span></td>
                            <td className="admin-td-muted">{new Date(m.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td>
                              <input type="checkbox" checked={m.is_admin} onChange={() => toggleAdmin(m)}
                                style={{ accentColor: 'var(--rose)', width: 15, height: 15, cursor: 'pointer' }} />
                            </td>
                            <td>
                              <div className="admin-actions">
                                <button
                                  className={`admin-btn-sm ${m.membership_status === 'active' ? '' : 'toggle'}`}
                                  onClick={() => toggleMembership(m)}
                                >
                                  {m.membership_status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button className="admin-btn-sm danger" onClick={() => deleteMember(m)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══════════ EVENTS ══════════ */}
          {tab === 'events' && (
            <>
              <div className="admin-page-hd">
                <div className="admin-page-title">
                  Events
                  <small>Create and manage gathering events</small>
                </div>
              </div>

              <div className="admin-kpi-row">
                <div className="admin-kpi">
                  <div className="admin-kpi-val">{events.length}</div>
                  <div className="admin-kpi-lbl">Total Events</div>
                </div>
                <div className="admin-kpi">
                  <div className="admin-kpi-val green">{upcomingCount}</div>
                  <div className="admin-kpi-lbl">Upcoming</div>
                </div>
                <div className="admin-kpi">
                  <div className="admin-kpi-val rose">{totalRsvps}</div>
                  <div className="admin-kpi-lbl">Total RSVPs</div>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-title">{editingEvent ? '✏️ Edit Event' : '＋ New Event'}</div>
                <form onSubmit={submitEvent} className="admin-form">
                  <div className="admin-form-grid">
                    <label className="auth-label">Title (EN)<input className="auth-input" value={eventForm.title} onChange={setEF('title')} required /></label>
                    <label className="auth-label">Title (ՀԱՅ)<input className="auth-input" value={eventForm.title_hy} onChange={setEF('title_hy')} /></label>
                    <label className="auth-label">Location<input className="auth-input" value={eventForm.location} onChange={setEF('location')} required /></label>
                    <label className="auth-label">Date &amp; Time<input className="auth-input" type="datetime-local" value={eventForm.event_date} onChange={setEF('event_date')} required /></label>
                    <label className="auth-label">Max Seats<input className="auth-input" type="number" value={eventForm.max_seats} onChange={setEF('max_seats')} min={1} required /></label>
                  </div>
                  <label className="auth-label">Description (EN)<textarea className="auth-input admin-textarea" value={eventForm.description} onChange={setEF('description')} /></label>
                  <label className="auth-label">Description (ՀԱՅ)<textarea className="auth-input admin-textarea" value={eventForm.description_hy} onChange={setEF('description_hy')} /></label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="admin-btn-sm primary" type="submit" style={{ padding: '9px 24px' }}>
                      {editingEvent ? 'Update Event' : 'Create Event'}
                    </button>
                    {editingEvent && (
                      <button type="button" className="admin-btn-sm" onClick={() => { setEditingEvent(null); setEventForm(EMPTY_EVENT) }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--stone)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                  All Events
                </span>
                <span className="admin-count-badge">{events.length}</span>
              </div>

              {events.length === 0
                ? <div className="admin-card" style={{ textAlign: 'center', color: 'var(--stone)', padding: '40px 24px' }}>No events yet</div>
                : events.map(ev => (
                  <div key={ev.id} className="admin-event-card">
                    <div className="admin-event-card-top">
                      <div style={{ flex: 1 }}>
                        <div className="admin-event-title">{ev.title}</div>
                        <div className="admin-event-meta">
                          📍 {ev.location}&nbsp;&nbsp;·&nbsp;&nbsp;
                          🗓 {new Date(ev.event_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}&nbsp;&nbsp;·&nbsp;&nbsp;
                          👥 {ev.seats_taken ?? 0}/{ev.max_seats} RSVPs
                        </div>
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
                      <div className="admin-event-attendees">
                        {attendees[ev.id].length === 0
                          ? <p style={{ color: 'var(--stone)', fontSize: 13 }}>No RSVPs yet.</p>
                          : (
                            <table className="admin-table" style={{ fontSize: 12 }}>
                              <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
                              <tbody>
                                {attendees[ev.id].map(a => (
                                  <tr key={a.id}>
                                    <td>
                                      <span className="admin-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{initials(a.full_name)}</span>
                                      {a.full_name}
                                    </td>
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
                ))
              }
            </>
          )}

          {/* ══════════ CONTENT ══════════ */}
          {tab === 'content' && (
            <>
              <div className="admin-page-hd">
                <div className="admin-page-title">
                  Content Library
                  <small>Manage recipes, e-books and unlocks</small>
                </div>
              </div>

              <div className="admin-kpi-row">
                <div className="admin-kpi">
                  <div className="admin-kpi-val">{content.length}</div>
                  <div className="admin-kpi-lbl">Total Items</div>
                </div>
                <div className="admin-kpi">
                  <div className="admin-kpi-val">{content.filter(c => c.type === 'recipe').length}</div>
                  <div className="admin-kpi-lbl">Recipes</div>
                </div>
                <div className="admin-kpi">
                  <div className="admin-kpi-val">{content.filter(c => c.type === 'ebook').length}</div>
                  <div className="admin-kpi-lbl">E-Books</div>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-title">{editingContent ? '✏️ Edit Item' : '＋ Add Content'}</div>
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
                    <label className="auth-label">File URL<input className="auth-input" value={contentForm.file_url} onChange={setCF('file_url')} placeholder="https://…" /></label>
                    <label className="auth-label">Cover Image URL<input className="auth-input" value={contentForm.cover_url} onChange={setCF('cover_url')} placeholder="https://…" /></label>
                  </div>
                  <label className="auth-label">Description (EN)<textarea className="auth-input admin-textarea" value={contentForm.description} onChange={setCF('description')} /></label>
                  <label className="auth-label">Description (ՀԱՅ)<textarea className="auth-input admin-textarea" value={contentForm.description_hy} onChange={setCF('description_hy')} /></label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="admin-btn-sm primary" type="submit" style={{ padding: '9px 24px' }}>
                      {editingContent ? 'Update' : 'Add Content'}
                    </button>
                    {editingContent && (
                      <button type="button" className="admin-btn-sm" onClick={() => { setEditingContent(null); setContentForm(EMPTY_CONTENT) }}>Cancel</button>
                    )}
                  </div>
                </form>
              </div>

              <div className="admin-card">
                <div className="admin-card-title">🔓 Unlock for Specific Member</div>
                <form onSubmit={handleUnlock} className="admin-form" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                  <label className="auth-label" style={{ flex: 1, minWidth: 160 }}>Content ID
                    <input className="auth-input" type="number" value={unlockTarget.contentId} onChange={e => setUnlockTarget(u => ({ ...u, contentId: e.target.value }))} required />
                  </label>
                  <label className="auth-label" style={{ flex: 1, minWidth: 160 }}>Member ID
                    <input className="auth-input" type="number" value={unlockTarget.userId} onChange={e => setUnlockTarget(u => ({ ...u, userId: e.target.value }))} required />
                  </label>
                  <button className="admin-btn-sm toggle" type="submit" style={{ marginBottom: 1 }}>Unlock</button>
                </form>
              </div>

              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--stone)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>All Content</span>
                <span className="admin-count-badge">{content.length}</span>
              </div>

              {content.length === 0
                ? <div className="admin-card" style={{ textAlign: 'center', color: 'var(--stone)', padding: '40px 24px' }}>No content yet</div>
                : (
                  <div className="library-grid">
                    {content.map(item => (
                      <div key={item.id} className="library-card" style={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        {item.cover_url && <img src={item.cover_url} alt={item.title} className="library-cover" style={{ borderRadius: '6px 6px 0 0' }} />}
                        <div className="library-type">{item.type} · #{item.id}</div>
                        <div className="library-title">{item.title}</div>
                        {item.description && <p className="library-desc">{item.description}</p>}
                        <div className="admin-actions" style={{ marginTop: 'auto', flexWrap: 'wrap' }}>
                          <button className="admin-btn-sm toggle" onClick={() => startEditContent(item)}>Edit</button>
                          <button className="admin-btn-sm" onClick={() => handleUnlockAll(item)}>Unlock All</button>
                          <button className="admin-btn-sm danger" onClick={() => deleteContent(item)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </>
          )}

          {/* ══════════ ANALYTICS ══════════ */}
          {tab === 'analytics' && (
            <>
              <div className="admin-page-hd">
                <div className="admin-page-title">
                  Analytics
                  <small>Deep insights into club activity</small>
                </div>
              </div>
              <AnalyticsDashboard />
            </>
          )}

          {/* ══════════ BROADCAST ══════════ */}
          {tab === 'broadcast' && (
            <>
              <div className="admin-page-hd">
                <div className="admin-page-title">
                  Broadcast Email
                  <small>Send a message to a member segment via Brevo</small>
                </div>
              </div>

              <div className="admin-card" style={{ maxWidth: 680 }}>
                <div className="admin-card-title">📨 Compose Message</div>
                <form onSubmit={handleBroadcast} className="admin-form">
                  <label className="auth-label">Audience
                    <select className="auth-input" value={broadcastForm.segment} onChange={e => setBroadcastForm(f => ({ ...f, segment: e.target.value }))}>
                      <option value="all">All Members</option>
                      <option value="active">Active Members Only</option>
                      <option value="inactive">Inactive Members Only</option>
                    </select>
                  </label>
                  <label className="auth-label">Subject Line
                    <input className="auth-input" value={broadcastForm.subject} onChange={e => setBroadcastForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Upcoming event this Friday!" required />
                  </label>
                  <label className="auth-label">
                    Body <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'var(--stone)' }}>(HTML supported — use {'{'}{'{'}<br />{'}'} for line breaks)</span>
                    <textarea className="auth-input admin-textarea" rows={10} value={broadcastForm.body} onChange={e => setBroadcastForm(f => ({ ...f, body: e.target.value }))} placeholder="<p>Hello,</p><p>We have an exciting announcement...</p>" required />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="admin-btn-sm primary" type="submit" disabled={broadcasting} style={{ padding: '10px 28px' }}>
                      {broadcasting ? 'Sending…' : '📨 Send Broadcast'}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--stone)' }}>
                      {broadcastForm.segment === 'all' && `Recipients: all ${members.length} members`}
                      {broadcastForm.segment === 'active' && `Recipients: ${activeCount} active members`}
                      {broadcastForm.segment === 'inactive' && `Recipients: ${inactiveCount} inactive members`}
                    </span>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* ══════════ AUDIT LOG ══════════ */}
          {tab === 'audit' && (
            <>
              <div className="admin-page-hd">
                <div className="admin-page-title">
                  Audit Log
                  <small>Last 100 admin actions, most recent first</small>
                </div>
                <div className="admin-page-actions">
                  <button className="admin-btn-sm" onClick={() => load('audit')}>↻ Refresh</button>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Admin</th>
                        <th>Action</th>
                        <th>Entity</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.length === 0
                        ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>No audit entries yet</td></tr>
                        : auditLog.map(entry => (
                          <tr key={entry.id}>
                            <td className="admin-td-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                              {new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ fontSize: 13 }}>
                              {entry.admin_name
                                ? <><span className="admin-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{initials(entry.admin_name)}</span>{entry.admin_name}</>
                                : <span style={{ color: 'var(--stone)' }}>—</span>
                              }
                            </td>
                            <td>
                              <span className={`action-chip ${actionChipClass(entry.action)}`}>{entry.action}</span>
                            </td>
                            <td className="admin-td-muted" style={{ fontSize: 12 }}>
                              {entry.entity_type ? `${entry.entity_type} #${entry.entity_id}` : '—'}
                            </td>
                            <td className="admin-td-muted" style={{ fontSize: 12, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {entry.details || '—'}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  )
}
