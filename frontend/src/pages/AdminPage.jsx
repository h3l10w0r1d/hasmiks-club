import '../admin.css'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Users, CalendarDays, BookOpen, BarChart3, Mail, ClipboardList,
  Download, RefreshCw, Send, ChevronRight, LogOut, LayoutDashboard,
  TrendingUp, CheckCircle2, XCircle, Percent, Search, ImageUp,
  SendHorizonal, StickyNote, Filter, UserCheck,
} from 'lucide-react'

import { Button }       from '../components/ui/button'
import { Badge }        from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Input }        from '../components/ui/input'
import { Textarea }     from '../components/ui/textarea'
import { Label }        from '../components/ui/label'
import { Skeleton }     from '../components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select'
import AnalyticsDashboard from '../components/AnalyticsDashboard'

import {
  adminGetMembers, adminUpdateMember, adminDeleteMember, adminSendTelegramInvite,
  adminGetEvents, adminGetEventAttendees, adminCreateEvent, adminUpdateEvent, adminDeleteEvent,
  adminToggleCheckin,
  adminGetContent, adminCreateContent, adminUpdateContent, adminDeleteContent,
  adminUnlockContent, adminUnlockContentForAll,
  adminUploadImage,
  adminBroadcast, adminExportCsv, adminGetAuditLog,
} from '../api/admin'

// ── helpers ───────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'members',   icon: Users,         label: 'Members'   },
  { key: 'events',    icon: CalendarDays,  label: 'Events'    },
  { key: 'content',   icon: BookOpen,      label: 'Content'   },
  { key: 'analytics', icon: BarChart3,     label: 'Analytics' },
  { key: 'broadcast', icon: Mail,          label: 'Broadcast' },
  { key: 'audit',     icon: ClipboardList, label: 'Audit Log' },
]

const EMPTY_EVENT   = { title: '', title_hy: '', description: '', description_hy: '', location: '', event_date: '', max_seats: 20 }
const EMPTY_CONTENT = { type: 'recipe', title: '', title_hy: '', description: '', description_hy: '', file_url: '', cover_url: '' }

function initials(name = '') {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function KpiCard({ icon: Icon, label, value, valueClass = '', loading }) {
  if (loading) return <Card><CardContent className="p-5"><Skeleton className="h-4 w-20 mb-3" /><Skeleton className="h-9 w-12" /></CardContent></Card>
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground/50" />}
        </div>
        <div className={`font-serif text-4xl font-semibold leading-none ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function SectionHeader({ title, sub, children }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground leading-tight">{title}</h1>
        {sub && <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{sub}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  )
}

function MemberAvatar({ name, size = 'md' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <span className={`inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold flex-shrink-0 ${sz}`}>
      {initials(name)}
    </span>
  )
}

// Inline image upload helper — shows file button next to URL field
function ImageUploadField({ label, value, onChange, onUpload }) {
  const ref = useRef(null)
  const [uploading, setUploading] = useState(false)
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await onUpload(file)
      onChange(res.url)
    } catch { /* ignore */ }
    finally { setUploading(false) }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="https://… or upload →" className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={uploading}>
          <ImageUp className="h-3.5 w-3.5" />
          {uploading ? '…' : 'Upload'}
        </Button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('members')

  const [members,   setMembers]   = useState([])
  const [events,    setEvents]    = useState([])
  const [content,   setContent]   = useState([])
  const [attendees, setAttendees] = useState({})
  const [auditLog,  setAuditLog]  = useState([])
  const [loading,   setLoading]   = useState({})

  const [memberSearch,   setMemberSearch]  = useState('')
  const [eventFilter,    setEventFilter]   = useState('all')   // all | upcoming | past
  const [contentFilter,  setContentFilter] = useState('all')   // all | recipe | ebook

  const [expandedNotes, setExpandedNotes] = useState({})       // memberId -> bool
  const [notesDraft,    setNotesDraft]    = useState({})        // memberId -> string
  const [savingNotes,   setSavingNotes]   = useState({})

  const [eventForm,      setEventForm]      = useState(EMPTY_EVENT)
  const [editingEvent,   setEditingEvent]   = useState(null)
  const [contentForm,    setContentForm]    = useState(EMPTY_CONTENT)
  const [editingContent, setEditingContent] = useState(null)
  const [unlockTarget,   setUnlockTarget]   = useState({ contentId: '', userId: '' })
  const [broadcastForm,  setBroadcastForm]  = useState({ subject: '', body: '', segment: 'all' })
  const [broadcasting,   setBroadcasting]  = useState(false)
  const [toast, setToast] = useState(null)

  const flash = (msg, isErr = false) => {
    setToast({ msg, type: isErr ? 'error' : 'success' })
    setTimeout(() => setToast(null), 3200)
  }

  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }))

  useEffect(() => { if (tab === 'members')   load('members')   }, [tab])
  useEffect(() => { if (tab === 'events')    load('events')    }, [tab])
  useEffect(() => { if (tab === 'content')   load('content')   }, [tab])
  useEffect(() => { if (tab === 'audit')     load('audit')     }, [tab])

  const load = async (t) => {
    setLoad(t, true)
    try {
      if (t === 'members') setMembers(await adminGetMembers())
      if (t === 'events')  setEvents(await adminGetEvents())
      if (t === 'content') setContent(await adminGetContent())
      if (t === 'audit')   setAuditLog(await adminGetAuditLog())
    } catch { flash('Failed to load data', true) }
    finally { setLoad(t, false) }
  }

  // ── members ──
  const toggleMembership = async (m) => {
    const next = m.membership_status === 'active' ? 'inactive' : 'active'
    await adminUpdateMember(m.id, { membership_status: next })
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, membership_status: next } : x))
    flash(`${m.full_name} → ${next}`)
  }
  const toggleAdmin = async (m) => {
    await adminUpdateMember(m.id, { is_admin: !m.is_admin })
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, is_admin: !m.is_admin } : x))
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
      a.href = url; a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { flash('Export failed', true) }
  }
  const handleSendTelegram = async (m) => {
    try {
      await adminSendTelegramInvite(m.id)
      flash(`Telegram invite sent to ${m.full_name}`)
    } catch (e) {
      flash(e?.response?.data?.detail || 'Failed to send invite', true)
    }
  }
  const toggleNotes = (m) => {
    setExpandedNotes(n => ({ ...n, [m.id]: !n[m.id] }))
    if (!notesDraft[m.id]) setNotesDraft(d => ({ ...d, [m.id]: m.admin_notes || '' }))
  }
  const saveNotes = async (m) => {
    setSavingNotes(s => ({ ...s, [m.id]: true }))
    try {
      await adminUpdateMember(m.id, { admin_notes: notesDraft[m.id] })
      setMembers(ms => ms.map(x => x.id === m.id ? { ...x, admin_notes: notesDraft[m.id] } : x))
      flash('Notes saved')
      setExpandedNotes(n => ({ ...n, [m.id]: false }))
    } catch { flash('Failed to save notes', true) }
    finally { setSavingNotes(s => ({ ...s, [m.id]: false })) }
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
        setEvents(es => [created, ...es]); flash('Event created')
      }
      setEventForm(EMPTY_EVENT); setEditingEvent(null)
    } catch { flash('Failed to save event', true) }
  }
  const startEditEvent = (ev) => {
    setEditingEvent(ev)
    setEventForm({ title: ev.title || '', title_hy: ev.title_hy || '', description: ev.description || '', description_hy: ev.description_hy || '', location: ev.location || '', event_date: ev.event_date ? ev.event_date.slice(0, 16) : '', max_seats: ev.max_seats })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const deleteEvent = async (ev) => {
    if (!confirm(`Delete "${ev.title}"?`)) return
    await adminDeleteEvent(ev.id); setEvents(es => es.filter(x => x.id !== ev.id)); flash('Event deleted')
  }
  const toggleAttendees = async (evId) => {
    if (attendees[evId]) { setAttendees(a => { const n = { ...a }; delete n[evId]; return n }); return }
    try { const list = await adminGetEventAttendees(evId); setAttendees(a => ({ ...a, [evId]: list })) }
    catch { flash('Failed to load attendees', true) }
  }
  const handleCheckin = async (evId, userId) => {
    try {
      const res = await adminToggleCheckin(evId, userId)
      setAttendees(a => ({ ...a, [evId]: a[evId].map(att => att.id === userId ? { ...att, checked_in: res.checked_in } : att) }))
    } catch { flash('Check-in failed', true) }
  }

  // ── content ──
  const setCF = k => e => setContentForm(f => ({ ...f, [k]: e.target.value }))
  const submitContent = async (e) => {
    e.preventDefault()
    try {
      if (editingContent) {
        const updated = await adminUpdateContent(editingContent.id, contentForm)
        setContent(cs => cs.map(x => x.id === editingContent.id ? updated : x)); flash('Content updated')
      } else {
        const created = await adminCreateContent(contentForm)
        setContent(cs => [created, ...cs]); flash('Content created')
      }
      setContentForm(EMPTY_CONTENT); setEditingContent(null)
    } catch { flash('Failed to save content', true) }
  }
  const startEditContent = (item) => {
    setEditingContent(item)
    setContentForm({ type: item.type, title: item.title || '', title_hy: item.title_hy || '', description: item.description || '', description_hy: item.description_hy || '', file_url: item.file_url || '', cover_url: item.cover_url || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const deleteContent = async (item) => {
    if (!confirm(`Delete "${item.title}"?`)) return
    await adminDeleteContent(item.id); setContent(cs => cs.filter(x => x.id !== item.id)); flash('Content deleted')
  }
  const handleUnlock = async (e) => {
    e.preventDefault()
    try {
      await adminUnlockContent(unlockTarget.contentId, unlockTarget.userId)
      flash(`Content #${unlockTarget.contentId} unlocked for member #${unlockTarget.userId}`)
      setUnlockTarget({ contentId: '', userId: '' })
    } catch { flash('Failed to unlock', true) }
  }
  const handleUnlockAll = async (item) => {
    if (!confirm(`Unlock "${item.title}" for ALL active members?`)) return
    try { await adminUnlockContentForAll(item.id); flash(`"${item.title}" unlocked for all active members`) }
    catch { flash('Failed to unlock', true) }
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
  const inactiveCount = members.length - activeCount
  const activationPct = members.length ? Math.round(activeCount / members.length * 100) : 0
  const upcomingCount = events.filter(ev => new Date(ev.event_date) > new Date()).length
  const totalRsvps    = events.reduce((s, ev) => s + (ev.seats_taken || 0), 0)
  const segmentCount  = broadcastForm.segment === 'active' ? activeCount : broadcastForm.segment === 'inactive' ? inactiveCount : members.length

  // filtered data
  const filteredMembers = members.filter(m =>
    !memberSearch || m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase())
  )
  const filteredEvents = events.filter(ev => {
    if (eventFilter === 'upcoming') return new Date(ev.event_date) >= new Date()
    if (eventFilter === 'past')     return new Date(ev.event_date) < new Date()
    return true
  })
  const filteredContent = content.filter(c => contentFilter === 'all' || c.type === contentFilter)

  const currentTab = TABS.find(t => t.key === tab)

  const Field = ({ label, children, className = '' }) => (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  )

  const isLoading = (key) => loading[key]

  const TableSkeleton = ({ cols, rows = 5 }) => (
    <>{Array.from({ length: rows }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
        ))}
      </TableRow>
    ))}</>
  )

  return (
    <div className="admin-shell flex min-h-screen bg-background">

      {/* ══ SIDEBAR ══════════════════════════════════════════ */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="brand">Hasmik's <span>Club</span></span>
          <span className="badge-label">Admin Panel</span>
        </div>
        <div className="admin-sidebar-nav">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button key={key} className={`admin-sidebar-item${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
              <span className="si-icon"><Icon size={15} /></span>
              {label}
            </button>
          ))}
        </div>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">{initials(user?.full_name)}</div>
            <span className="admin-sidebar-name">{user?.full_name}</span>
          </div>
          <button className="admin-sidebar-btn back" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={13} /> Member view
          </button>
          <button className="admin-sidebar-btn signout" onClick={() => { signOut(); navigate('/') }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* ══ BODY ═════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur px-8 gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">Admin</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs font-semibold text-foreground">{currentTab?.label}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {toast && (
            <div className={`fixed top-5 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-in slide-in-from-right-4 duration-200 min-w-[240px] ${toast.type === 'success' ? 'bg-[#1a100a] text-[#f0e8df]' : 'bg-destructive text-destructive-foreground'}`}>
              {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
              {toast.msg}
            </div>
          )}

          {/* ══ MEMBERS ══ */}
          {tab === 'members' && (
            <div className="space-y-6">
              <SectionHeader title="Members" sub="Manage all registered members">
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              </SectionHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={Users}        label="Total"    value={members.length}    loading={isLoading('members')} />
                <KpiCard icon={CheckCircle2} label="Active"   value={activeCount}       loading={isLoading('members')} valueClass="text-emerald-600" />
                <KpiCard icon={XCircle}      label="Inactive" value={inactiveCount}     loading={isLoading('members')} />
                <KpiCard icon={Percent}      label="Rate"     value={`${activationPct}%`} loading={isLoading('members')} valueClass="text-primary" />
              </div>

              {/* search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or email…"
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                />
              </div>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading('members')
                      ? <TableSkeleton cols={6} />
                      : filteredMembers.length === 0
                        ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">{memberSearch ? 'No matching members' : 'No members yet'}</TableCell></TableRow>
                        : filteredMembers.map(m => (
                          <>
                            <TableRow key={m.id}>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <MemberAvatar name={m.full_name} />
                                  <div>
                                    <div className="font-medium text-sm">{m.full_name}</div>
                                    {m.admin_notes && <div className="text-xs text-muted-foreground truncate max-w-[160px]">📝 {m.admin_notes}</div>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{m.email}</TableCell>
                              <TableCell>
                                <Badge variant={m.membership_status === 'active' ? 'success' : 'muted'}>{m.membership_status}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{fmtDate(m.joined_at)}</TableCell>
                              <TableCell>
                                <input type="checkbox" checked={m.is_admin} onChange={() => toggleAdmin(m)} className="h-4 w-4 cursor-pointer accent-primary" />
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1.5 flex-wrap">
                                  <Button variant={m.membership_status === 'active' ? 'outline' : 'success'} size="sm" onClick={() => toggleMembership(m)}>
                                    {m.membership_status === 'active' ? 'Deactivate' : 'Activate'}
                                  </Button>
                                  <Button variant="outline" size="sm" title="Send Telegram invite" onClick={() => handleSendTelegram(m)}>
                                    <SendHorizonal className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="outline" size="sm" title="Notes" onClick={() => toggleNotes(m)}>
                                    <StickyNote className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => deleteMember(m)}>Delete</Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedNotes[m.id] && (
                              <TableRow key={`${m.id}-notes`} className="bg-muted/30">
                                <TableCell colSpan={6} className="py-3 px-6">
                                  <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                      <Label className="mb-1.5">Private notes for {m.full_name}</Label>
                                      <Textarea
                                        rows={2}
                                        placeholder="e.g. paid by bank transfer, referred by Hasmik…"
                                        value={notesDraft[m.id] ?? m.admin_notes ?? ''}
                                        onChange={e => setNotesDraft(d => ({ ...d, [m.id]: e.target.value }))}
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => saveNotes(m)} disabled={savingNotes[m.id]}>
                                        {savingNotes[m.id] ? 'Saving…' : 'Save'}
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setExpandedNotes(n => ({ ...n, [m.id]: false }))}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))
                    }
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ══ EVENTS ══ */}
          {tab === 'events' && (
            <div className="space-y-6">
              <SectionHeader title="Events" sub="Create and manage gathering events" />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KpiCard icon={CalendarDays} label="Total Events" value={events.length}    loading={isLoading('events')} />
                <KpiCard icon={TrendingUp}   label="Upcoming"     value={upcomingCount}    loading={isLoading('events')} valueClass="text-emerald-600" />
                <KpiCard icon={Users}        label="Total RSVPs"  value={totalRsvps}       loading={isLoading('events')} valueClass="text-primary" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{editingEvent ? '✏️  Edit Event' : '＋  New Event'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitEvent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Title (EN)"><Input value={eventForm.title} onChange={setEF('title')} required /></Field>
                      <Field label="Title (ՀԱՅ)"><Input value={eventForm.title_hy} onChange={setEF('title_hy')} /></Field>
                      <Field label="Location"><Input value={eventForm.location} onChange={setEF('location')} required /></Field>
                      <Field label="Date & Time"><Input type="datetime-local" value={eventForm.event_date} onChange={setEF('event_date')} required /></Field>
                      <Field label="Max Seats"><Input type="number" value={eventForm.max_seats} onChange={setEF('max_seats')} min={1} required /></Field>
                    </div>
                    <Field label="Description (EN)"><Textarea value={eventForm.description} onChange={setEF('description')} /></Field>
                    <Field label="Description (ՀԱՅ)"><Textarea value={eventForm.description_hy} onChange={setEF('description_hy')} /></Field>
                    <div className="flex gap-2">
                      <Button type="submit">{editingEvent ? 'Update Event' : 'Create Event'}</Button>
                      {editingEvent && <Button type="button" variant="outline" onClick={() => { setEditingEvent(null); setEventForm(EMPTY_EVENT) }}>Cancel</Button>}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* filter */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Filter className="h-3 w-3" /> Filter</span>
                {['all', 'upcoming', 'past'].map(f => (
                  <Button key={f} size="sm" variant={eventFilter === f ? 'default' : 'outline'} onClick={() => setEventFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Button>
                ))}
                <Badge variant="secondary" className="ml-auto">{filteredEvents.length} events</Badge>
              </div>

              {isLoading('events')
                ? <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-72" /></CardContent></Card>)}</div>
                : filteredEvents.length === 0
                  ? <Card><CardContent className="py-12 text-center text-muted-foreground">No events</CardContent></Card>
                  : filteredEvents.map(ev => (
                    <Card key={ev.id} className="overflow-hidden">
                      <div className="flex items-start justify-between gap-4 p-5 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="font-serif text-lg font-semibold text-foreground mb-1">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">
                            📍 {ev.location} &nbsp;·&nbsp; 🗓 {fmtDateTime(ev.event_date)} &nbsp;·&nbsp; 👥 {ev.seats_taken ?? 0}/{ev.max_seats}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button variant="outline" size="sm" onClick={() => toggleAttendees(ev.id)}>
                            <UserCheck className="h-3.5 w-3.5" />{attendees[ev.id] ? 'Hide' : 'Check-in'}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => startEditEvent(ev)}>Edit</Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteEvent(ev)}>Delete</Button>
                        </div>
                      </div>
                      {attendees[ev.id] && (
                        <div className="border-t border-border bg-muted/30 px-5 py-4">
                          {attendees[ev.id].length === 0
                            ? <p className="text-sm text-muted-foreground">No RSVPs yet.</p>
                            : (
                              <>
                                <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                                  <span>
                                    <strong className="text-emerald-600">{attendees[ev.id].filter(a => a.checked_in).length}</strong> / {attendees[ev.id].length} checked in
                                  </span>
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Email</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Check-in</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {attendees[ev.id].map(a => (
                                      <TableRow key={a.id}>
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            <MemberAvatar name={a.full_name} size="sm" />
                                            <span className="text-sm">{a.full_name}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{a.email}</TableCell>
                                        <TableCell><Badge variant={a.membership_status === 'active' ? 'success' : 'muted'}>{a.membership_status}</Badge></TableCell>
                                        <TableCell>
                                          <Button
                                            size="sm"
                                            variant={a.checked_in ? 'success' : 'outline'}
                                            onClick={() => handleCheckin(ev.id, a.id)}
                                          >
                                            {a.checked_in ? <><CheckCircle2 className="h-3.5 w-3.5" /> Present</> : 'Mark present'}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </>
                            )
                          }
                        </div>
                      )}
                    </Card>
                  ))
              }
            </div>
          )}

          {/* ══ CONTENT ══ */}
          {tab === 'content' && (
            <div className="space-y-6">
              <SectionHeader title="Content Library" sub="Manage recipes, e-books and member unlocks" />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KpiCard icon={BookOpen} label="Total"   value={content.length}                               loading={isLoading('content')} />
                <KpiCard icon={BookOpen} label="Recipes" value={content.filter(c => c.type === 'recipe').length} loading={isLoading('content')} />
                <KpiCard icon={BookOpen} label="E-Books" value={content.filter(c => c.type === 'ebook').length}  loading={isLoading('content')} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{editingContent ? '✏️  Edit Item' : '＋  Add Content'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitContent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Type">
                        <Select value={contentForm.type} onValueChange={v => setContentForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recipe">Recipe</SelectItem>
                            <SelectItem value="ebook">E-Book</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Title (EN)"><Input value={contentForm.title} onChange={setCF('title')} required /></Field>
                      <Field label="Title (ՀԱՅ)"><Input value={contentForm.title_hy} onChange={setCF('title_hy')} /></Field>
                      <ImageUploadField
                        label="File URL"
                        value={contentForm.file_url}
                        onChange={v => setContentForm(f => ({ ...f, file_url: v }))}
                        onUpload={adminUploadImage}
                      />
                      <ImageUploadField
                        label="Cover Image"
                        value={contentForm.cover_url}
                        onChange={v => setContentForm(f => ({ ...f, cover_url: v }))}
                        onUpload={adminUploadImage}
                      />
                    </div>
                    <Field label="Description (EN)"><Textarea value={contentForm.description} onChange={setCF('description')} /></Field>
                    <Field label="Description (ՀԱՅ)"><Textarea value={contentForm.description_hy} onChange={setCF('description_hy')} /></Field>
                    <div className="flex gap-2">
                      <Button type="submit">{editingContent ? 'Update' : 'Add Content'}</Button>
                      {editingContent && <Button type="button" variant="outline" onClick={() => { setEditingContent(null); setContentForm(EMPTY_CONTENT) }}>Cancel</Button>}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">🔓 Unlock for Specific Member</CardTitle>
                  <CardDescription>Enter content ID and member ID to manually unlock.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUnlock} className="flex flex-wrap gap-3 items-end">
                    <Field label="Content ID" className="flex-1 min-w-[140px]">
                      <Input type="number" value={unlockTarget.contentId} onChange={e => setUnlockTarget(u => ({ ...u, contentId: e.target.value }))} required />
                    </Field>
                    <Field label="Member ID" className="flex-1 min-w-[140px]">
                      <Input type="number" value={unlockTarget.userId} onChange={e => setUnlockTarget(u => ({ ...u, userId: e.target.value }))} required />
                    </Field>
                    <Button type="submit" variant="secondary">Unlock</Button>
                  </form>
                </CardContent>
              </Card>

              {/* filter */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Filter className="h-3 w-3" /> Type</span>
                {['all', 'recipe', 'ebook'].map(f => (
                  <Button key={f} size="sm" variant={contentFilter === f ? 'default' : 'outline'} onClick={() => setContentFilter(f)}>
                    {f === 'all' ? 'All' : f === 'recipe' ? 'Recipes' : 'E-Books'}
                  </Button>
                ))}
                <Badge variant="secondary" className="ml-auto">{filteredContent.length} items</Badge>
              </div>

              {isLoading('content')
                ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-36 w-full mb-3 rounded" /><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-full" /></CardContent></Card>)}</div>
                : filteredContent.length === 0
                  ? <Card><CardContent className="py-12 text-center text-muted-foreground">No content yet</CardContent></Card>
                  : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredContent.map(item => (
                        <Card key={item.id} className="flex flex-col overflow-hidden">
                          {item.cover_url && <img src={item.cover_url} alt={item.title} className="w-full h-36 object-cover" />}
                          <CardContent className="p-4 flex flex-col flex-1 gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{item.type}</Badge>
                              <span className="text-xs text-muted-foreground">#{item.id}</span>
                            </div>
                            <p className="font-serif font-semibold text-base leading-tight">{item.title}</p>
                            {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                            <div className="flex gap-2 mt-auto pt-2 flex-wrap">
                              <Button variant="secondary"   size="sm" onClick={() => startEditContent(item)}>Edit</Button>
                              <Button variant="outline"     size="sm" onClick={() => handleUnlockAll(item)}>Unlock All</Button>
                              <Button variant="destructive" size="sm" onClick={() => deleteContent(item)}>Delete</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )
              }
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {tab === 'analytics' && (
            <div className="space-y-6">
              <SectionHeader title="Analytics" sub="Deep insights into club activity" />
              <AnalyticsDashboard />
            </div>
          )}

          {/* ══ BROADCAST ══ */}
          {tab === 'broadcast' && (
            <div className="space-y-6">
              <SectionHeader title="Broadcast Email" sub="Send a message to a member segment via Brevo" />
              <Card className="max-w-2xl">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> Compose Message</CardTitle>
                  <CardDescription>HTML is supported in the body.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBroadcast} className="space-y-4">
                    <Field label="Audience">
                      <Select value={broadcastForm.segment} onValueChange={v => setBroadcastForm(f => ({ ...f, segment: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Members ({members.length})</SelectItem>
                          <SelectItem value="active">Active Members ({activeCount})</SelectItem>
                          <SelectItem value="inactive">Inactive Members ({inactiveCount})</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Subject Line">
                      <Input value={broadcastForm.subject} onChange={e => setBroadcastForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Upcoming event this Friday!" required />
                    </Field>
                    <Field label="Body (HTML supported)">
                      <Textarea rows={10} value={broadcastForm.body} onChange={e => setBroadcastForm(f => ({ ...f, body: e.target.value }))} placeholder="<p>Hello,</p><p>We have an exciting announcement...</p>" required />
                    </Field>
                    <Button type="submit" disabled={broadcasting}>
                      <Send className="h-3.5 w-3.5" />
                      {broadcasting ? 'Sending…' : `Send to ${segmentCount} recipient${segmentCount !== 1 ? 's' : ''}`}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ══ AUDIT LOG ══ */}
          {tab === 'audit' && (
            <div className="space-y-6">
              <SectionHeader title="Audit Log" sub="Last 100 admin actions, most recent first">
                <Button variant="outline" size="sm" onClick={() => load('audit')}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </SectionHeader>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading('audit')
                      ? <TableSkeleton cols={5} />
                      : auditLog.length === 0
                        ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">No audit entries yet</TableCell></TableRow>
                        : auditLog.map(entry => {
                            const action = entry.action || ''
                            const chip = action.includes('delete') ? 'destructive' : action.includes('create') ? 'success' : 'secondary'
                            return (
                              <TableRow key={entry.id}>
                                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{fmtDateTime(entry.created_at)}</TableCell>
                                <TableCell>
                                  {entry.admin_name
                                    ? <div className="flex items-center gap-2"><MemberAvatar name={entry.admin_name} size="sm" /><span className="text-sm">{entry.admin_name}</span></div>
                                    : <span className="text-muted-foreground">—</span>
                                  }
                                </TableCell>
                                <TableCell><Badge variant={chip} className="font-mono text-xs">{action}</Badge></TableCell>
                                <TableCell className="text-muted-foreground text-sm">{entry.entity_type ? `${entry.entity_type} #${entry.entity_id}` : '—'}</TableCell>
                                <TableCell className="text-muted-foreground text-xs max-w-[260px] truncate">{entry.details || '—'}</TableCell>
                              </TableRow>
                            )
                          })
                    }
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
