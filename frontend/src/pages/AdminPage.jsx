import '../admin.css'
import { useState, useEffect, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Users, CalendarDays, BookOpen, BarChart3, Mail, ClipboardList,
  Download, RefreshCw, Send, ChevronRight, LogOut, LayoutDashboard,
  TrendingUp, CheckCircle2, XCircle, Percent, Search, ImageUp,
  SendHorizonal, StickyNote, Filter, UserCheck,
  Inbox, GalleryHorizontal, Settings2, Trophy, Link2, Plus, Trash2, ExternalLink,
  Shield, MapPin, Pencil, Unlock, CreditCard, RotateCcw, Ban, ScrollText, Crop,
  Ticket, QrCode, BadgeCheck, Menu, X, Gift, Eye, PanelsTopLeft, Flag,
} from 'lucide-react'

import { Button }       from '../components/ui/button'
import { Badge }        from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Input }        from '../components/ui/input'
import { Textarea }     from '../components/ui/textarea'
import { Label }        from '../components/ui/label'
import { Skeleton }     from '../components/ui/skeleton'
import { RowMenu }      from '../components/ui/RowMenu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table'
import { Combobox } from '../components/ui/combobox'
import { DateTimePicker } from '../components/ui/datetimepicker'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import SiteEditor from '../components/SiteEditor'
import GalleryManager from '../components/GalleryManager'
import CropModal from '../components/CropModal'
import RichTextEditor from '../components/ui/RichTextEditor'
import { stripHtml } from '../utils/sanitizeHtml'
import {
  initials, fmtDate, fmtDateTime, KpiCard, SectionHeader, Field, TableSkeleton, MemberAvatar,
} from '../components/ui/AdminShared'

import {
  adminGetMembers, adminUpdateMember, adminDeleteMember, adminSendTelegramInvite, adminCancelAutoRenew,
  adminGetApplications, adminApproveApplication, adminDeclineApplication,
  adminGetReferrals,
  adminGetEvents, adminGetEventAttendees, adminCreateEvent, adminUpdateEvent, adminDeleteEvent,
  adminToggleCheckin, adminToggleGuestTicketCheckin,
  adminGetContent, adminCreateContent, adminUpdateContent, adminDeleteContent,
  adminUnlockContent, adminUnlockContentForAll,
  adminUploadImage,
  adminGetAlbums, adminGetAlbum, adminCreateAlbum, adminUpdateAlbum, adminDeleteAlbum,
  adminUploadGalleryPhoto,
  adminBroadcast, adminExportCsv, adminGetAuditLog,
  adminGetSettings, adminSaveSettings,
  adminGetRoles, adminUpdateRole,
  adminGetPayments, adminRefreshPayment, adminRefundPayment, adminCancelPayment, adminGetPaymentLogs,
  adminGetGuestTickets, adminGetGuestTicketLogs,
  adminGetGiftCards, adminResendGiftCard,
  adminGetForumReports, adminResolveForumReport, adminDismissForumReport,
} from '../api/admin'

// ── permissions ───────────────────────────────────────────────────────────────
const ALL_PERMISSIONS = [
  'manage_members', 'manage_events', 'manage_content', 'manage_gallery',
  'manage_applications', 'manage_settings', 'broadcast', 'view_analytics',
  'view_audit', 'manage_roles', 'manage_payments',
]

const ROLE_PERMISSIONS = {
  admin:     ALL_PERMISSIONS,
  moderator: ['manage_events', 'manage_content', 'manage_gallery', 'manage_applications', 'view_analytics'],
  member:    [],
}

const PERMISSION_LABELS = {
  manage_members:      'Manage Members',
  manage_events:       'Manage Events',
  manage_content:      'Manage Content',
  manage_gallery:      'Manage Gallery',
  manage_applications: 'Manage Applications',
  manage_settings:     'Manage Settings',
  broadcast:           'Broadcast Emails',
  view_analytics:      'View Analytics',
  view_audit:          'View Audit Log',
  manage_roles:        'Manage Roles & Permissions',
  manage_payments:     'Manage Payments',
}

function getUserPermissions(user) {
  if (user?.permissions) {
    try { return JSON.parse(user.permissions) } catch { /* ignore */ }
  }
  return ROLE_PERMISSIONS[user?.role] || []
}

function canDo(user, perm) {
  return getUserPermissions(user).includes(perm)
}

// ── helpers ───────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'today',        icon: LayoutDashboard,   label: 'Today'        },
  { key: 'members',      icon: Users,             label: 'Members'      },
  { key: 'applications', icon: Inbox,             label: 'Applications' },
  { key: 'roles',        icon: Shield,            label: 'Roles'        },
  { key: 'events',       icon: CalendarDays,      label: 'Events'       },
  { key: 'site_editor',  icon: PanelsTopLeft,     label: 'Site Editor'  },
  { key: 'content',      icon: BookOpen,          label: 'Content'      },
  { key: 'gallery',      icon: GalleryHorizontal, label: 'Gallery'      },
  { key: 'moderation',   icon: Flag,              label: 'Moderation'   },
  { key: 'analytics',    icon: BarChart3,         label: 'Analytics'    },
  { key: 'payments',     icon: CreditCard,        label: 'Payments'     },
  { key: 'one_timers',   icon: Ticket,            label: 'One-Timers'   },
  { key: 'gift_cards',   icon: Gift,              label: 'Gift Cards'   },
  { key: 'broadcast',    icon: Mail,              label: 'Broadcast'    },
  { key: 'audit',        icon: ClipboardList,     label: 'Audit Log'    },
  { key: 'settings',     icon: Settings2,         label: 'Settings'     },
]

const TAB_GROUPS = [
  { label: 'OVERVIEW', keys: ['today'] },
  { label: 'PEOPLE',   keys: ['members', 'applications', 'roles'] },
  { label: 'CONTENT',  keys: ['events', 'site_editor', 'content', 'gallery', 'moderation'] },
  { label: 'INSIGHTS', keys: ['analytics', 'payments', 'one_timers', 'gift_cards'] },
  { label: 'OUTREACH', keys: ['broadcast'] },
  { label: 'CONFIG',   keys: ['audit', 'settings'] },
]

const TAB_PERMISSION_MAP = {
  today:        null,
  members:      'manage_members',
  applications: 'manage_applications',
  events:       'manage_events',
  site_editor:  'manage_settings',
  content:      'manage_content',
  gallery:      'manage_gallery',
  moderation:   'manage_members',
  analytics:    'view_analytics',
  payments:     'manage_payments',
  one_timers:   'manage_events',
  gift_cards:   'manage_events',
  broadcast:    'broadcast',
  audit:        'view_audit',
  settings:     'manage_settings',
  roles:        'manage_roles',
}

const EMPTY_ALBUM = { title: '', description: '', event_id: '', cover_url: '' }

const DEFAULT_SETTINGS = {
  telegram_invite_url: '', require_approval: 'false',
  membership_price_display: '', club_description: '',
  club_instagram: '', club_location: '', club_email: '', club_phone: '',
  welcome_email_body: '', event_reminder_body: '', email_footer: '',
  gift_price_1m: '', gift_price_3m: '', gift_price_6m: '', gift_price_12m: '',
}

const EMPTY_EVENT   = { title: '', title_hy: '', description: '', description_hy: '', location: '', map_url: '', event_date: '', max_seats: 20, cover_url: '', ticket_price: '', max_guest_tickets: '' }
const EMPTY_CONTENT = { type: 'recipe', title: '', title_hy: '', description: '', description_hy: '', file_url: '', cover_url: '' }

// Inline image upload helper — shows file button next to URL field
function ImageUploadField({ label, value, onChange, onUpload }) {
  const ref = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)

  const doUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const res = await onUpload(file)
      onChange(res.url)
    } catch { /* ignore */ }
    finally { setUploading(false) }
  }
  const handleFile = (e) => doUpload(e.target.files?.[0])
  const handleDrop = (e) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    const file = Array.from(e.dataTransfer.files || []).find(f => f.type.startsWith('image/'))
    if (file) doUpload(file)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div
        className={`flex gap-2 rounded-md transition-colors ${dragOver ? 'ring-2 ring-primary bg-primary/5' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) setDragOver(false) }}
        onDrop={handleDrop}
      >
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder={dragOver ? 'Drop image to upload…' : 'https://… or upload, or drag & drop an image'} className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={uploading}>
          <ImageUp className="h-3.5 w-3.5" />
          {uploading ? '…' : 'Upload'}
        </Button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}

// Cover image field with a crop step — file goes through CropModal before upload
function CoverImageCropField({ label, value, onChange, onUpload }) {
  const ref = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [pendingSrc, setPendingSrc] = useState(null)
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingSrc(URL.createObjectURL(file))
  }
  const handleCropConfirm = async (blob) => {
    setPendingSrc(null)
    setUploading(true)
    try {
      const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' })
      const res = await onUpload(file)
      onChange(res.url)
    } catch { /* ignore */ }
    finally { setUploading(false) }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="https://… or upload & crop →" className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={uploading}>
          <Crop className="h-3.5 w-3.5" />
          {uploading ? '…' : 'Upload'}
        </Button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {pendingSrc && (
        <CropModal
          imageSrc={pendingSrc}
          aspect={16 / 9}
          onCancel={() => setPendingSrc(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('today')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)   // { label, onConfirm, confirmLabel? }

  const [members,   setMembers]   = useState([])
  const [events,    setEvents]    = useState([])
  const [content,   setContent]   = useState([])
  const [attendees, setAttendees] = useState({})
  const [auditLog,  setAuditLog]  = useState([])
  const [loading,   setLoading]   = useState({})

  const [memberSearch,   setMemberSearch]  = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState(null) // null = not searching, use full `members`
  const [eventFilter,    setEventFilter]   = useState('all')   // all | upcoming | past
  const [eventSearch,    setEventSearch]   = useState('')
  const [eventSearchResults, setEventSearchResults] = useState(null)   // null = not searching, use full `events`
  const [contentFilter,  setContentFilter] = useState('all')   // all | recipe | ebook

  // Real (server-side) search — debounced, falls back to the already-loaded
  // full list when the query is empty so KPI counts stay accurate.
  useEffect(() => {
    if (!memberSearch.trim()) { setMemberSearchResults(null); return }
    const id = setTimeout(() => {
      adminGetMembers(memberSearch.trim()).then(setMemberSearchResults).catch(() => {})
    }, 300)
    return () => clearTimeout(id)
  }, [memberSearch])

  useEffect(() => {
    if (!eventSearch.trim()) { setEventSearchResults(null); return }
    const id = setTimeout(() => {
      adminGetEvents(eventSearch.trim()).then(setEventSearchResults).catch(() => {})
    }, 300)
    return () => clearTimeout(id)
  }, [eventSearch])

  const [applications, setApplications] = useState([])
  const [albums,       setAlbums]       = useState([])
  const [openAlbum,    setOpenAlbum]    = useState(null)   // full album detail
  const [albumForm,    setAlbumForm]    = useState(EMPTY_ALBUM)

  const [adminSettings,  setAdminSettings]  = useState(DEFAULT_SETTINGS)
  const [settingsForm,   setSettingsForm]   = useState(DEFAULT_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)

  const [referrals, setReferrals] = useState([])

  const [expandedNotes, setExpandedNotes] = useState({})       // memberId -> bool
  const [notesDraft,    setNotesDraft]    = useState({})        // memberId -> string
  const [savingNotes,   setSavingNotes]   = useState({})

  const [eventForm,      setEventForm]      = useState(EMPTY_EVENT)
  const [editingEvent,   setEditingEvent]   = useState(null)
  const [showEventForm,  setShowEventForm]  = useState(false)
  const [contentForm,    setContentForm]    = useState(EMPTY_CONTENT)
  const [editingContent, setEditingContent] = useState(null)
  const [showContentForm, setShowContentForm] = useState(false)
  const [unlockTarget,   setUnlockTarget]   = useState({ contentId: '', userId: '' })
  const [broadcastForm,  setBroadcastForm]  = useState({ subject: '', body: '', segment: 'all' })
  const [broadcasting,   setBroadcasting]  = useState(false)
  const [toast, setToast] = useState(null)

  const [roles,       setRoles]       = useState([])
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm,    setRoleForm]    = useState({ role: 'member', permissions: null })
  const [savingRole,  setSavingRole]  = useState(false)

  const [payments,        setPayments]        = useState([])
  const [paymentActionId,  setPaymentActionId] = useState(null)
  const [logsPayment,     setLogsPayment]      = useState(null)   // payment row whose logs are shown, or null
  const [logsData,        setLogsData]         = useState([])
  const [logsLoading,     setLogsLoading]      = useState(false)

  const [guestTickets,     setGuestTickets]     = useState([])
  const [guestTicketQuery, setGuestTicketQuery] = useState('')
  const [guestTicketStatusFilter, setGuestTicketStatusFilter] = useState('all')

  const [giftCards,        setGiftCards]        = useState([])
  const [giftCardQuery,    setGiftCardQuery]    = useState('')
  const [giftCardStatusFilter, setGiftCardStatusFilter] = useState('all')
  const [giftCardTypeFilter,   setGiftCardTypeFilter]   = useState('all')
  const [resendingGiftId,  setResendingGiftId]  = useState(null)

  const [reports,          setReports]          = useState([])
  const [reportStatusFilter, setReportStatusFilter] = useState('pending')
  const [reportActionId,   setReportActionId]   = useState(null)

  const flash = (msg, isErr = false) => {
    setToast({ msg, type: isErr ? 'error' : 'success' })
    setTimeout(() => setToast(null), 3200)
  }

  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }))

  useEffect(() => {
    if (tab === 'today') {
      load('members')
      load('applications')
      load('events')
    }
  }, [tab])
  useEffect(() => { if (tab === 'members')      load('members')      }, [tab])
  useEffect(() => { if (tab === 'applications') load('applications') }, [tab])
  useEffect(() => { if (tab === 'events')       load('events')       }, [tab])
  useEffect(() => { if (tab === 'content')      load('content')      }, [tab])
  useEffect(() => { if (tab === 'gallery')      { load('gallery'); load('events') } }, [tab])
  useEffect(() => { if (tab === 'audit')        load('audit')        }, [tab])
  useEffect(() => { if (tab === 'settings')     load('settings')     }, [tab])
  useEffect(() => { if (tab === 'analytics')    load('referrals')    }, [tab])
  useEffect(() => { if (tab === 'roles')        load('roles')        }, [tab])
  useEffect(() => { if (tab === 'payments')     load('payments')     }, [tab])
  useEffect(() => { if (tab === 'one_timers')   load('one_timers')   }, [tab])
  useEffect(() => { if (tab === 'gift_cards')   load('gift_cards')   }, [tab])
  useEffect(() => { if (tab === 'moderation')   load('moderation')   }, [tab, reportStatusFilter])

  const load = async (t) => {
    setLoad(t, true)
    try {
      if (t === 'members')      setMembers(await adminGetMembers())
      if (t === 'applications') setApplications(await adminGetApplications())
      if (t === 'events')       setEvents(await adminGetEvents())
      if (t === 'content')      setContent(await adminGetContent())
      if (t === 'gallery')      setAlbums(await adminGetAlbums())
      if (t === 'audit')        setAuditLog(await adminGetAuditLog())
      if (t === 'referrals')    setReferrals(await adminGetReferrals())
      if (t === 'roles')        setRoles(await adminGetRoles())
      if (t === 'payments')     setPayments(await adminGetPayments())
      if (t === 'one_timers')   setGuestTickets(await adminGetGuestTickets())
      if (t === 'gift_cards')  setGiftCards(await adminGetGiftCards())
      if (t === 'moderation')  setReports(await adminGetForumReports(reportStatusFilter))
      if (t === 'settings') {
        const s = await adminGetSettings()
        setAdminSettings(s)
        setSettingsForm({ ...DEFAULT_SETTINGS, ...s })
      }
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
  const handleCancelAutoRenew = (m) => {
    setDeleteTarget({
      label: `Turn off auto-renew for ${m.full_name}? Their membership stays active until the current period ends.`,
      confirmLabel: 'Turn off',
      onConfirm: async () => {
        await adminCancelAutoRenew(m.id)
        setMembers(ms => ms.map(x => x.id === m.id ? { ...x, binding_active: false } : x))
        flash(`Auto-renew turned off for ${m.full_name}`)
      },
    })
  }
  const deleteMember = (m) => {
    setDeleteTarget({
      label: `Delete ${m.full_name}? This cannot be undone.`,
      onConfirm: async () => {
        await adminDeleteMember(m.id)
        setMembers(ms => ms.filter(x => x.id !== m.id))
        flash('Member deleted')
      },
    })
  }
  const handleDismissReport = async (report) => {
    setReportActionId(report.id)
    try {
      await adminDismissForumReport(report.id)
      setReports(rs => rs.filter(r => r.id !== report.id))
      flash('Report dismissed')
    } catch { flash('Failed to dismiss report', true) }
    finally { setReportActionId(null) }
  }
  const handleResolveReport = async (report, deleteTarget) => {
    setReportActionId(report.id)
    try {
      await adminResolveForumReport(report.id, deleteTarget)
      setReports(rs => rs.filter(r => r.id !== report.id))
      flash(deleteTarget ? 'Content removed and report resolved' : 'Report resolved')
    } catch { flash('Failed to resolve report', true) }
    finally { setReportActionId(null) }
  }
  const confirmDeleteReportedContent = (report) => {
    setDeleteTarget({
      label: `Delete this ${report.target_type}? This cannot be undone.`,
      confirmLabel: 'Delete content',
      onConfirm: () => handleResolveReport(report, true),
    })
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
      const payload = {
        ...eventForm,
        max_seats: Number(eventForm.max_seats),
        ticket_price: eventForm.ticket_price === '' ? null : Number(eventForm.ticket_price),
        max_guest_tickets: eventForm.max_guest_tickets === '' ? null : Number(eventForm.max_guest_tickets),
        map_url: eventForm.map_url.trim() === '' ? null : eventForm.map_url.trim(),
      }
      if (editingEvent) {
        const updated = await adminUpdateEvent(editingEvent.id, payload)
        setEvents(es => es.map(x => x.id === editingEvent.id ? updated : x))
        flash('Event updated')
      } else {
        const created = await adminCreateEvent(payload)
        setEvents(es => [created, ...es]); flash('Event created')
      }
      setEventForm(EMPTY_EVENT); setEditingEvent(null); setShowEventForm(false)
    } catch { flash('Failed to save event', true) }
  }
  const startEditEvent = (ev) => {
    setEditingEvent(ev)
    setShowEventForm(true)
    setEventForm({
      title: ev.title || '', title_hy: ev.title_hy || '', description: ev.description || '', description_hy: ev.description_hy || '',
      location: ev.location || '', map_url: ev.map_url || '', event_date: ev.event_date ? ev.event_date.slice(0, 16) : '', max_seats: ev.max_seats, cover_url: ev.cover_url || '',
      ticket_price: ev.ticket_price ?? '', max_guest_tickets: ev.max_guest_tickets ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const deleteEvent = (ev) => {
    setDeleteTarget({
      label: `Delete "${ev.title}"?`,
      onConfirm: async () => {
        await adminDeleteEvent(ev.id)
        setEvents(es => es.filter(x => x.id !== ev.id))
        flash('Event deleted')
      },
    })
  }
  const toggleAttendees = async (evId) => {
    if (attendees[evId]) { setAttendees(a => { const n = { ...a }; delete n[evId]; return n }); return }
    try { const list = await adminGetEventAttendees(evId); setAttendees(a => ({ ...a, [evId]: list })) }
    catch { flash('Failed to load attendees', true) }
  }
  const handleCheckin = async (evId, attendee) => {
    try {
      const res = attendee.source === 'guest'
        ? await adminToggleGuestTicketCheckin(evId, attendee.id)
        : await adminToggleCheckin(evId, attendee.id)
      setAttendees(a => ({
        ...a,
        [evId]: a[evId].map(att => (att.id === attendee.id && att.source === attendee.source) ? { ...att, checked_in: res.checked_in } : att),
      }))
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
      setContentForm(EMPTY_CONTENT); setEditingContent(null); setShowContentForm(false)
    } catch { flash('Failed to save content', true) }
  }
  const startEditContent = (item) => {
    setEditingContent(item)
    setShowContentForm(true)
    setContentForm({ type: item.type, title: item.title || '', title_hy: item.title_hy || '', description: item.description || '', description_hy: item.description_hy || '', file_url: item.file_url || '', cover_url: item.cover_url || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const deleteContent = (item) => {
    setDeleteTarget({
      label: `Delete "${item.title}"?`,
      onConfirm: async () => {
        await adminDeleteContent(item.id)
        setContent(cs => cs.filter(x => x.id !== item.id))
        flash('Content deleted')
      },
    })
  }
  const handleUnlock = async (e) => {
    e.preventDefault()
    try {
      await adminUnlockContent(unlockTarget.contentId, unlockTarget.userId)
      flash(`Content #${unlockTarget.contentId} unlocked for member #${unlockTarget.userId}`)
      setUnlockTarget({ contentId: '', userId: '' })
    } catch { flash('Failed to unlock', true) }
  }
  const handleUnlockAll = (item) => {
    setDeleteTarget({
      label: `Unlock "${item.title}" for ALL active members?`,
      confirmLabel: 'Unlock All',
      onConfirm: async () => {
        try { await adminUnlockContentForAll(item.id); flash(`"${item.title}" unlocked for all active members`) }
        catch { flash('Failed to unlock', true) }
      },
    })
  }

  // ── applications ──
  const handleApprove = async (app) => {
    try {
      await adminApproveApplication(app.id)
      setApplications(a => a.filter(x => x.id !== app.id))
      flash(`${app.full_name} approved`)
    } catch { flash('Failed to approve', true) }
  }
  const handleDecline = (app) => {
    setDeleteTarget({
      label: `Decline ${app.full_name}'s application?`,
      confirmLabel: 'Decline',
      onConfirm: async () => {
        try {
          await adminDeclineApplication(app.id)
          setApplications(a => a.filter(x => x.id !== app.id))
          flash(`${app.full_name} declined`)
        } catch { flash('Failed to decline', true) }
      },
    })
  }

  // ── payments ──
  const handleRefreshPayment = async (p) => {
    setPaymentActionId(p.id)
    try {
      const updated = await adminRefreshPayment(p.id)
      setPayments(ps => ps.map(x => x.id === p.id ? updated : x))
      flash(`Status refreshed: ${updated.status}`)
    } catch (err) { flash(err.response?.data?.detail || 'Failed to refresh payment', true) }
    finally { setPaymentActionId(null) }
  }
  const handleRefundPayment = (p) => {
    setDeleteTarget({
      label: `Refund ${p.amount} ${p.currency === '051' ? 'AMD' : p.currency} for order #${p.order_id}?`,
      confirmLabel: 'Refund',
      onConfirm: async () => {
        setPaymentActionId(p.id)
        try {
          const updated = await adminRefundPayment(p.id, p.amount)
          setPayments(ps => ps.map(x => x.id === p.id ? updated : x))
          flash('Payment refunded')
        } catch (err) { flash(err.response?.data?.detail || 'Refund failed', true) }
        finally { setPaymentActionId(null) }
      },
    })
  }
  const handleCancelPayment = (p) => {
    setDeleteTarget({
      label: `Cancel order #${p.order_id}? This only works within 72 hours of payment.`,
      confirmLabel: 'Cancel Payment',
      onConfirm: async () => {
        setPaymentActionId(p.id)
        try {
          const updated = await adminCancelPayment(p.id)
          setPayments(ps => ps.map(x => x.id === p.id ? updated : x))
          flash('Payment cancelled')
        } catch (err) { flash(err.response?.data?.detail || 'Cancel failed', true) }
        finally { setPaymentActionId(null) }
      },
    })
  }
  const handleViewLogs = async (p) => {
    setLogsPayment(p)
    setLogsLoading(true)
    try {
      setLogsData(await adminGetPaymentLogs(p.id))
    } catch {
      flash('Failed to load payment logs', true)
      setLogsData([])
    } finally {
      setLogsLoading(false)
    }
  }
  // Same logs modal, but for a one-time guest ticket (own log table).
  const handleViewGuestLogs = async (t) => {
    setLogsPayment(t)
    setLogsLoading(true)
    try {
      setLogsData(await adminGetGuestTicketLogs(t.id))
    } catch {
      flash('Failed to load ticket logs', true)
      setLogsData([])
    } finally {
      setLogsLoading(false)
    }
  }

  // ── gallery ──
  const submitAlbum = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...albumForm, event_id: albumForm.event_id ? Number(albumForm.event_id) : null }
      const created = await adminCreateAlbum(payload)
      setAlbums(a => [created, ...a])
      setAlbumForm(EMPTY_ALBUM)
      flash('Album created')
    } catch { flash('Failed to create album', true) }
  }
  const deleteAlbum = (album) => {
    setDeleteTarget({
      label: `Delete album "${album.title}" and all its photos?`,
      onConfirm: async () => {
        await adminDeleteAlbum(album.id)
        setAlbums(a => a.filter(x => x.id !== album.id))
        if (openAlbum?.id === album.id) setOpenAlbum(null)
        flash('Album deleted')
      },
    })
  }
  const openAlbumDetail = async (album) => {
    if (openAlbum?.id === album.id) { setOpenAlbum(null); return }
    const detail = await adminGetAlbum(album.id)
    setOpenAlbum(detail)
  }
  // keeps both the expanded album detail and the summary list in sync after
  // GalleryManager mutates photos (upload/delete/reorder/set-cover)
  const handleAlbumPatch = (patch) => {
    setOpenAlbum(a => a ? { ...a, ...patch } : a)
    setAlbums(a => a.map(x => x.id === openAlbum?.id ? { ...x, ...patch } : x))
  }

  // ── settings ──
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      await adminSaveSettings(settingsForm)
      setAdminSettings(settingsForm)
      flash('Settings saved')
    } catch { flash('Failed to save settings', true) }
    finally { setSavingSettings(false) }
  }

  // ── broadcast ──
  const handleBroadcast = (e) => {
    e.preventDefault()
    setDeleteTarget({
      label: `Send email to "${broadcastForm.segment}" segment (${segmentCount} recipient${segmentCount !== 1 ? 's' : ''})?`,
      confirmLabel: 'Send',
      onConfirm: async () => {
        setBroadcasting(true)
        try {
          const res = await adminBroadcast(broadcastForm)
          flash(`Sent to ${res.sent_to} recipient${res.sent_to !== 1 ? 's' : ''}`)
          setBroadcastForm({ subject: '', body: '', segment: 'all' })
        } catch { flash('Broadcast failed', true) }
        finally { setBroadcasting(false) }
      },
    })
  }

  // ── roles ──
  const openRoleEdit = (u) => {
    setEditingRole(u)
    setRoleForm({
      role: u.role,
      permissions: u.permissions ? JSON.parse(u.permissions) : null,
    })
  }

  const handleSaveRole = async () => {
    if (!editingRole) return
    setSavingRole(true)
    try {
      const payload = {
        role: roleForm.role,
        permissions: roleForm.permissions,
      }
      const updated = await adminUpdateRole(editingRole.id, payload)
      setRoles(rs => rs.map(r => r.id === updated.id ? { ...r, ...updated } : r))
      setEditingRole(null)
      flash(`${editingRole.full_name}'s role updated`)
    } catch { flash('Failed to update role', true) }
    finally { setSavingRole(false) }
  }

  const togglePermission = (perm) => {
    setRoleForm(f => {
      const current = f.permissions ?? ROLE_PERMISSIONS[f.role] ?? []
      const has = current.includes(perm)
      const next = has ? current.filter(p => p !== perm) : [...current, perm]
      const defaults = ROLE_PERMISSIONS[f.role] || []
      const isDefault = next.length === defaults.length && next.every(p => defaults.includes(p))
      return { ...f, permissions: isDefault ? null : next }
    })
  }

  const resetToRoleDefaults = () => {
    setRoleForm(f => ({ ...f, permissions: null }))
  }

  // derived stats
  const activeCount   = members.filter(m => m.membership_status === 'active').length
  const inactiveCount = members.length - activeCount
  const activationPct = members.length ? Math.round(activeCount / members.length * 100) : 0
  const upcomingCount = events.filter(ev => new Date(ev.event_date) > new Date()).length
  const totalRsvps    = events.reduce((s, ev) => s + (ev.seats_taken || 0), 0)
  const segmentCount  = broadcastForm.segment === 'active' ? activeCount : broadcastForm.segment === 'inactive' ? inactiveCount : members.length

  // filtered data
  const filteredMembers = memberSearchResults ?? members
  const filteredEvents = (eventSearchResults ?? events).filter(ev => {
    if (eventFilter === 'upcoming') return new Date(ev.event_date) >= new Date()
    if (eventFilter === 'past')     return new Date(ev.event_date) < new Date()
    return true
  })
  const filteredContent = content.filter(c => contentFilter === 'all' || c.type === contentFilter)
  const filteredGuestTickets = guestTickets.filter(t => {
    if (guestTicketStatusFilter !== 'all' && t.status !== guestTicketStatusFilter) return false
    if (!guestTicketQuery) return true
    const q = guestTicketQuery.toLowerCase()
    return t.full_name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || (t.event_title || '').toLowerCase().includes(q) || (t.phone || '').toLowerCase().includes(q)
  })
  const filteredGiftCards = giftCards.filter(g => {
    if (giftCardStatusFilter !== 'all' && g.status !== giftCardStatusFilter) return false
    if (giftCardTypeFilter !== 'all' && g.gift_type !== giftCardTypeFilter) return false
    if (!giftCardQuery) return true
    const q = giftCardQuery.toLowerCase()
    return g.giver_name.toLowerCase().includes(q) || g.giver_email.toLowerCase().includes(q) ||
      g.recipient_name.toLowerCase().includes(q) || g.recipient_email.toLowerCase().includes(q)
  })

  const handleResendGift = async (giftId) => {
    setResendingGiftId(giftId)
    try { await adminResendGiftCard(giftId); flash('Gift email resent') }
    catch (err) { flash(err?.response?.data?.detail || 'Failed to resend', true) }
    finally { setResendingGiftId(null) }
  }

  const currentTab = TABS.find(t => t.key === tab)

  const isLoading = (key) => loading[key]

  return (
    <div className="admin-shell flex bg-background">

      {/* ══ SIDEBAR ══════════════════════════════════════════ */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="brand">Hasmik's <span>Club</span></span>
          <span className="badge-label">Admin Panel</span>
          <button
            className="admin-mobile-nav-toggle"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(o => !o)}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <div className={`admin-sidebar-nav${mobileNavOpen ? ' mobile-open' : ''}`}>
          {TAB_GROUPS.map(group => (
            <div className="admin-nav-group" key={group.label}>
              <div className="admin-nav-group-label">{group.label}</div>
              {group.keys.map(key => {
                const t = TABS.find(x => x.key === key)
                if (!t) return null
                const reqPerm = TAB_PERMISSION_MAP[key]
                if (reqPerm && !canDo(user, reqPerm)) return null
                const { icon: Icon, label } = t
                return (
                  <button key={key} className={`admin-sidebar-item${tab === key ? ' active' : ''}`} onClick={() => { setTab(key); setMobileNavOpen(false) }}>
                    <span className="si-icon"><Icon size={15} /></span>
                    {label}
                    {key === 'applications' && applications.length > 0 && (
                      <span className="admin-sidebar-badge">{applications.length}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          <div className="admin-mobile-nav-footer">
            <button className="admin-sidebar-btn back" onClick={() => { setMobileNavOpen(false); navigate('/dashboard') }}>
              <LayoutDashboard size={13} /> Member view
            </button>
            <button className="admin-sidebar-btn signout" onClick={() => { setMobileNavOpen(false); signOut(); navigate('/') }}>
              <LogOut size={13} /> Sign out
            </button>
          </div>
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
      {mobileNavOpen && <div className="admin-mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />}

      {/* ══ BODY ═════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <header className="flex h-14 items-center border-b border-border bg-background px-8 gap-2 flex-shrink-0">
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

          {/* ══ TODAY ══ */}
          {tab === 'today' && (() => {
            const hour = new Date().getHours()
            const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
            const now = new Date()
            const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            const weekEvents = events.filter(ev => {
              const d = new Date(ev.event_date)
              return d >= now && d <= weekLater
            })
            const pendingApps = applications.slice(0, 3)
            const todayLoading = isLoading('members') || isLoading('events') || isLoading('applications')
            return (
              <div className="space-y-8">
                <div>
                  <h1 className="font-serif text-3xl font-light text-foreground leading-tight">
                    {greeting}, {user?.full_name?.split(' ')[0] || user?.full_name || 'Admin'}
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Here's what's happening today</p>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard icon={Users}        label="Total Members"        value={members.length}                  loading={todayLoading} />
                  <KpiCard icon={CheckCircle2} label="Active Members"       value={activeCount}                     loading={todayLoading} valueClass="text-emerald-600" />
                  <KpiCard icon={Inbox}        label="Pending Applications" value={applications.length}             loading={todayLoading} valueClass={applications.length > 0 ? 'text-amber-600' : ''} />
                  <KpiCard icon={CalendarDays} label="Upcoming Events"      value={upcomingCount}                   loading={todayLoading} valueClass="text-primary" />
                </div>

                {/* Pending applications quick section */}
                <div>
                  <h2 className="font-serif text-xl font-semibold mb-4 text-foreground">Pending Applications</h2>
                  {todayLoading
                    ? <Card><CardContent className="py-8 text-center"><Skeleton className="h-4 w-32 mx-auto" /></CardContent></Card>
                    : applications.length === 0
                      ? (
                        <Card>
                          <CardContent className="py-8 flex items-center justify-center gap-2 text-emerald-600 font-medium text-sm">
                            <CheckCircle2 className="h-4 w-4" /> All clear — no pending applications
                          </CardContent>
                        </Card>
                      )
                      : (
                        <div className="space-y-3">
                          {pendingApps.map(app => (
                            <Card key={app.id}>
                              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                                <MemberAvatar name={app.full_name} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm">{app.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{app.email} · Applied {fmtDate(app.joined_at)}</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button size="sm" variant="success" onClick={() => handleApprove(app)}>
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleDecline(app)}>
                                    <XCircle className="h-3.5 w-3.5" /> Decline
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          {applications.length > 3 && (
                            <p className="text-xs text-muted-foreground text-center pt-1">
                              +{applications.length - 3} more — <button className="underline cursor-pointer" onClick={() => setTab('applications')}>view all</button>
                            </p>
                          )}
                        </div>
                      )
                  }
                </div>

                {/* This week's events */}
                <div>
                  <h2 className="font-serif text-xl font-semibold mb-4 text-foreground">This Week's Events</h2>
                  {todayLoading
                    ? <div className="space-y-3">{[1,2].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-2 w-full" /></CardContent></Card>)}</div>
                    : weekEvents.length === 0
                      ? <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No events in the next 7 days</CardContent></Card>
                      : (
                        <div className="space-y-3">
                          {weekEvents.map(ev => {
                            const taken = ev.seats_taken ?? 0
                            const max = ev.max_seats ?? 1
                            const pct = Math.min(100, Math.round(taken / max * 100))
                            return (
                              <Card key={ev.id}>
                                <CardContent className="p-5">
                                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                                    <div>
                                      <p className="font-serif font-semibold text-base leading-tight">{ev.title}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                                        <MapPin className="h-3 w-3" /> {ev.location} <span>·</span> <CalendarDays className="h-3 w-3" /> {fmtDateTime(ev.event_date)}
                                      </p>
                                    </div>
                                    <Badge variant={pct >= 100 ? 'destructive' : pct >= 75 ? 'secondary' : 'success'}>
                                      {taken}/{max} seats
                                    </Badge>
                                  </div>
                                  <div style={{ height: 6, background: 'hsl(var(--muted))', borderRadius: 9999, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'hsl(var(--destructive))' : pct >= 75 ? 'hsl(var(--primary) / 0.7)' : 'hsl(142 70% 45%)', borderRadius: 9999, transition: 'width 0.4s ease' }} />
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1.5">{pct}% full</p>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      )
                  }
                </div>
              </div>
            )
          })()}

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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading('members')
                      ? <TableSkeleton cols={6} />
                      : filteredMembers.length === 0
                        ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">{memberSearch ? 'No matching members' : 'No members yet'}</TableCell></TableRow>
                        : filteredMembers.map(m => (
                          <Fragment key={m.id}>
                            <TableRow>
                              <TableCell>
                                <div
                                  className="flex items-center gap-2.5 cursor-pointer group"
                                  onClick={() => navigate(`/admin/members/${m.id}`)}
                                  role="link"
                                  tabIndex={0}
                                  onKeyDown={e => { if (e.key === 'Enter') navigate(`/admin/members/${m.id}`) }}
                                >
                                  <MemberAvatar name={m.full_name} />
                                  <div>
                                    <div className="font-medium text-sm flex items-center gap-1.5 group-hover:text-primary group-hover:underline">
                                      {m.full_name}
                                      {m.is_admin && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Admin</Badge>}
                                    </div>
                                    {m.admin_notes && (
                                      <div className="text-xs text-muted-foreground truncate max-w-[160px] flex items-center gap-1">
                                        <StickyNote className="h-3 w-3 flex-shrink-0" /> {m.admin_notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{m.email}</TableCell>
                              <TableCell>
                                <Badge variant={m.membership_status === 'active' ? 'success' : m.membership_status === 'past_due' ? 'warning' : 'muted'}>{m.membership_status}</Badge>
                                {m.binding_active && (
                                  <div className="text-[11px] text-muted-foreground mt-1">
                                    Auto-renew{m.next_billing_date ? ` · ${fmtDate(m.next_billing_date)}` : ''}
                                  </div>
                                )}
                                {m.card_required_by && !m.binding_active && (
                                  <div className="text-[11px] text-amber-600 mt-1">Card due {fmtDate(m.card_required_by)}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{fmtDate(m.joined_at)}</TableCell>
                              <TableCell>
                                <div className="flex justify-end items-center gap-2">
                                  <Button variant={m.membership_status === 'active' ? 'outline' : 'success'} size="sm" onClick={() => toggleMembership(m)}>
                                    {m.membership_status === 'active' ? 'Deactivate' : 'Activate'}
                                  </Button>
                                  <RowMenu items={[
                                    { icon: Eye, label: 'View full profile', onClick: () => navigate(`/admin/members/${m.id}`) },
                                    { icon: SendHorizonal, label: 'Send Telegram invite', onClick: () => handleSendTelegram(m) },
                                    { icon: StickyNote, label: m.admin_notes ? 'Edit private notes' : 'Add private notes', onClick: () => toggleNotes(m) },
                                    { icon: Shield, label: m.is_admin ? 'Revoke admin access' : 'Make admin', onClick: () => toggleAdmin(m) },
                                    ...(m.binding_active ? [{ icon: CreditCard, label: 'Cancel auto-renew', onClick: () => handleCancelAutoRenew(m) }] : []),
                                    { separator: true },
                                    { icon: Trash2, label: 'Delete member', danger: true, onClick: () => deleteMember(m) },
                                  ]} />
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedNotes[m.id] && (
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={5} className="py-3 px-6">
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
                          </Fragment>
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
              <SectionHeader title="Events" sub="Create and manage gathering events">
                <Button size="sm" variant={showEventForm ? 'outline' : 'default'} onClick={() => { setEditingEvent(null); setEventForm(EMPTY_EVENT); setShowEventForm(s => !s) }}>
                  {showEventForm ? <><XCircle className="h-3.5 w-3.5" /> Close</> : <><Plus className="h-3.5 w-3.5" /> New Event</>}
                </Button>
              </SectionHeader>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KpiCard icon={CalendarDays} label="Total Events" value={events.length}    loading={isLoading('events')} />
                <KpiCard icon={TrendingUp}   label="Upcoming"     value={upcomingCount}    loading={isLoading('events')} valueClass="text-emerald-600" />
                <KpiCard icon={Users}        label="Total RSVPs"  value={totalRsvps}       loading={isLoading('events')} valueClass="text-primary" />
              </div>

              {showEventForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    {editingEvent ? <><Pencil className="h-3.5 w-3.5" /> Edit Event</> : <><Plus className="h-3.5 w-3.5" /> New Event</>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitEvent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Title (EN)"><Input value={eventForm.title} onChange={setEF('title')} required /></Field>
                      <Field label="Title (ՀԱՅ)"><Input value={eventForm.title_hy} onChange={setEF('title_hy')} /></Field>
                      <Field label="Location"><Input value={eventForm.location} onChange={setEF('location')} required /></Field>
                      <Field label="Yandex Maps Link (optional)">
                        <Input type="url" value={eventForm.map_url} onChange={setEF('map_url')} placeholder="https://yandex.com/maps/…" />
                      </Field>
                      <Field label="Date & Time"><DateTimePicker value={eventForm.event_date} onChange={v => setEventForm(f => ({ ...f, event_date: v }))} /></Field>
                      <Field label="Max Seats"><Input type="number" value={eventForm.max_seats} onChange={setEF('max_seats')} min={1} required /></Field>
                      <Field label="One-time Ticket Price (blank = members only)">
                        <Input type="number" step="1" min="0" value={eventForm.ticket_price} onChange={setEF('ticket_price')} placeholder="e.g. 5000" />
                      </Field>
                      <Field label="Max Guest Tickets (blank = shared with member seats)">
                        <Input type="number" min="0" value={eventForm.max_guest_tickets} onChange={setEF('max_guest_tickets')} placeholder="e.g. 10" />
                      </Field>
                    </div>
                    <Field label="Description (EN)">
                      <RichTextEditor
                        key={`ev-desc-en-${editingEvent?.id ?? 'new'}`}
                        initialContent={eventForm.description}
                        onChange={html => setEventForm(f => ({ ...f, description: html }))}
                        onUploadImage={adminUploadImage}
                      />
                    </Field>
                    <Field label="Description (ՀԱՅ)">
                      <RichTextEditor
                        key={`ev-desc-hy-${editingEvent?.id ?? 'new'}`}
                        initialContent={eventForm.description_hy}
                        onChange={html => setEventForm(f => ({ ...f, description_hy: html }))}
                        onUploadImage={adminUploadImage}
                      />
                    </Field>
                    <ImageUploadField
                      label="Cover Image (shown on the events page)"
                      value={eventForm.cover_url}
                      onChange={v => setEventForm(f => ({ ...f, cover_url: v }))}
                      onUpload={adminUploadImage}
                    />
                    {eventForm.cover_url && (
                      <img
                        src={eventForm.cover_url}
                        alt="Cover preview"
                        style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                      />
                    )}
                    <div className="flex gap-2">
                      <Button type="submit">{editingEvent ? 'Update Event' : 'Create Event'}</Button>
                      <Button type="button" variant="outline" onClick={() => { setEditingEvent(null); setEventForm(EMPTY_EVENT); setShowEventForm(false) }}>Cancel</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
              )}

              {/* search + filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by title or location…"
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                />
              </div>
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
                          <p className="text-xs text-muted-foreground flex items-center flex-wrap gap-x-1.5">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ev.location}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDateTime(ev.event_date)}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ev.seats_taken ?? 0}/{ev.max_seats}</span>
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
                            ? <p className="text-sm text-muted-foreground">No RSVPs or one-time tickets yet.</p>
                            : (
                              <>
                                <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                                  <span>
                                    <strong className="text-emerald-600">{attendees[ev.id].filter(a => a.checked_in).length}</strong> / {attendees[ev.id].length} checked in
                                  </span>
                                  <span>·</span>
                                  <span>{attendees[ev.id].filter(a => a.source === 'guest').length} one-timer{attendees[ev.id].filter(a => a.source === 'guest').length !== 1 ? 's' : ''}</span>
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
                                      <TableRow key={`${a.source}-${a.id}`}>
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            <MemberAvatar name={a.full_name} size="sm" />
                                            <span className="text-sm">{a.full_name}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{a.email}</TableCell>
                                        <TableCell><Badge variant={a.source === 'guest' ? 'secondary' : a.membership_status === 'active' ? 'success' : 'muted'}>{a.source === 'guest' ? 'one-timer' : a.membership_status}</Badge></TableCell>
                                        <TableCell>
                                          <Button
                                            size="sm"
                                            variant={a.checked_in ? 'success' : 'outline'}
                                            onClick={() => handleCheckin(ev.id, a)}
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
              <SectionHeader title="Content Library" sub="Manage recipes, e-books and member unlocks">
                <Button size="sm" variant={showContentForm ? 'outline' : 'default'} onClick={() => { setEditingContent(null); setContentForm(EMPTY_CONTENT); setShowContentForm(s => !s) }}>
                  {showContentForm ? <><XCircle className="h-3.5 w-3.5" /> Close</> : <><Plus className="h-3.5 w-3.5" /> Add Content</>}
                </Button>
              </SectionHeader>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KpiCard icon={BookOpen} label="Total"   value={content.length}                               loading={isLoading('content')} />
                <KpiCard icon={BookOpen} label="Recipes" value={content.filter(c => c.type === 'recipe').length} loading={isLoading('content')} />
                <KpiCard icon={BookOpen} label="E-Books" value={content.filter(c => c.type === 'ebook').length}  loading={isLoading('content')} />
              </div>

              {showContentForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    {editingContent ? <><Pencil className="h-3.5 w-3.5" /> Edit Item</> : <><Plus className="h-3.5 w-3.5" /> Add Content</>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitContent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Type">
                        <Combobox
                          value={contentForm.type}
                          onChange={v => setContentForm(f => ({ ...f, type: v }))}
                          options={[{ value: 'recipe', label: 'Recipe' }, { value: 'ebook', label: 'E-Book' }]}
                          searchPlaceholder="Search type…"
                        />
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
                    <Field label="Description (EN)">
                      <RichTextEditor
                        key={`ct-desc-en-${editingContent?.id ?? 'new'}`}
                        initialContent={contentForm.description}
                        onChange={html => setContentForm(f => ({ ...f, description: html }))}
                        onUploadImage={adminUploadImage}
                      />
                    </Field>
                    <Field label="Description (ՀԱՅ)">
                      <RichTextEditor
                        key={`ct-desc-hy-${editingContent?.id ?? 'new'}`}
                        initialContent={contentForm.description_hy}
                        onChange={html => setContentForm(f => ({ ...f, description_hy: html }))}
                        onUploadImage={adminUploadImage}
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button type="submit">{editingContent ? 'Update' : 'Add Content'}</Button>
                      <Button type="button" variant="outline" onClick={() => { setEditingContent(null); setContentForm(EMPTY_CONTENT); setShowContentForm(false) }}>Cancel</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-1.5"><Unlock className="h-3.5 w-3.5" /> Unlock for Specific Member</CardTitle>
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
                            {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{stripHtml(item.description)}</p>}
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

          {/* ══ APPLICATIONS ══ */}
          {tab === 'applications' && (
            <div className="space-y-6">
              <SectionHeader title="Applications" sub="Pending membership applications awaiting review">
                <Button variant="outline" size="sm" onClick={() => load('applications')}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </SectionHeader>

              {isLoading('applications')
                ? <Card><CardContent className="py-12 text-center"><Skeleton className="h-4 w-32 mx-auto" /></CardContent></Card>
                : applications.length === 0
                  ? (
                    <Card>
                      <CardContent className="py-16 text-center">
                        <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground text-sm">No pending applications</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Enable "Require approval" in Settings to use this feature</p>
                      </CardContent>
                    </Card>
                  )
                  : (
                    <div className="space-y-4">
                      {applications.map(app => (
                        <Card key={app.id}>
                          <CardContent className="p-5">
                            <div className="flex items-start gap-4 flex-wrap">
                              <MemberAvatar name={app.full_name} />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm">{app.full_name}</p>
                                <p className="text-xs text-muted-foreground">{app.email}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Applied {fmtDate(app.joined_at)}</p>
                                {app.application_message && (
                                  <div className="mt-3 p-3 bg-muted/40 rounded-lg">
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Application message</p>
                                    <p className="text-sm">{app.application_message}</p>
                                  </div>
                                )}
                                {app.referred_by_id && (
                                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                    <Link2 className="h-3 w-3" /> Referred by member #{app.referred_by_id}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button size="sm" variant="success" onClick={() => handleApprove(app)}>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDecline(app)}>
                                  <XCircle className="h-3.5 w-3.5" /> Decline
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )
              }
            </div>
          )}

          {/* ══ GALLERY ══ */}
          {tab === 'gallery' && (
            <div className="space-y-6">
              <SectionHeader title="Gallery" sub="Event photo albums visible to all members" />

              <Card>
                <CardHeader><CardTitle className="text-sm"><Plus className="inline h-3.5 w-3.5 mr-1" />New Album</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={submitAlbum} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Album Title"><Input value={albumForm.title} onChange={e => setAlbumForm(f => ({ ...f, title: e.target.value }))} required /></Field>
                      <Field label="Linked Event (optional)">
                        <Combobox
                          value={albumForm.event_id ? String(albumForm.event_id) : 'none'}
                          onChange={v => setAlbumForm(f => ({ ...f, event_id: v === 'none' ? '' : v }))}
                          options={[{ value: 'none', label: 'Standalone (no linked event)' }, ...events.map(ev => ({ value: String(ev.id), label: ev.title }))]}
                          placeholder="Standalone album"
                          searchPlaceholder="Search events…"
                          emptyText="No events found"
                        />
                      </Field>
                    </div>
                    <Field label="Description"><Textarea value={albumForm.description} onChange={e => setAlbumForm(f => ({ ...f, description: e.target.value }))} rows={2} /></Field>
                    <CoverImageCropField label="Cover Image" value={albumForm.cover_url} onChange={v => setAlbumForm(f => ({ ...f, cover_url: v }))} onUpload={adminUploadGalleryPhoto} />
                    <Button type="submit">Create Album</Button>
                  </form>
                </CardContent>
              </Card>

              {isLoading('gallery')
                ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full mb-3 rounded" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>)}</div>
                : albums.length === 0
                  ? <Card><CardContent className="py-12 text-center text-muted-foreground">No albums yet</CardContent></Card>
                  : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                      {albums.map(album => (
                        <Card key={album.id} className={`overflow-hidden${openAlbum?.id === album.id ? ' sm:col-span-2 lg:col-span-3' : ''}`}>
                          {album.cover_url
                            ? <img src={album.cover_url} alt={album.title} className="w-full h-36 object-cover" />
                            : <div className="w-full h-36 bg-muted flex items-center justify-center"><GalleryHorizontal className="h-8 w-8 text-muted-foreground/40" /></div>
                          }
                          <div className="flex items-start gap-3 p-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className="font-serif font-semibold">{album.title}</p>
                              {album.description && <p className="text-xs text-muted-foreground line-clamp-1">{album.description}</p>}
                              <p className="text-xs text-muted-foreground mt-0.5">{album.photo_count} photo{album.photo_count !== 1 ? 's' : ''} · {fmtDate(album.created_at)}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Button variant="outline" size="sm" onClick={() => openAlbumDetail(album)}>
                                {openAlbum?.id === album.id ? 'Close' : 'Manage Photos'}
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => deleteAlbum(album)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {openAlbum?.id === album.id && (
                            <GalleryManager album={openAlbum} onAlbumChange={handleAlbumPatch} flash={flash} />
                          )}
                        </Card>
                      ))}
                    </div>
                  )
              }
            </div>
          )}

          {/* ══ MODERATION ══ */}
          {tab === 'moderation' && (
            <div className="space-y-6">
              <SectionHeader title="Moderation" sub="Forum posts and topics flagged by members" />

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Filter className="h-3 w-3" /> Status</span>
                {['pending', 'resolved', 'dismissed', 'all'].map(f => (
                  <Button key={f} size="sm" variant={reportStatusFilter === f ? 'default' : 'outline'} onClick={() => setReportStatusFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Button>
                ))}
                <Badge variant="secondary" className="ml-auto">{reports.length} reports</Badge>
              </div>

              {isLoading('moderation')
                ? <div className="space-y-3">{[1, 2].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-72" /></CardContent></Card>)}</div>
                : reports.length === 0
                  ? <Card><CardContent className="p-10 text-center text-muted-foreground text-sm">No {reportStatusFilter !== 'all' ? reportStatusFilter : ''} reports</CardContent></Card>
                  : (
                    <div className="space-y-3">
                      {reports.map(r => (
                        <Card key={r.id}>
                          <CardContent className="p-5 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="uppercase text-[10px]">{r.target_type}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  Reported by {r.reporter?.full_name} · {new Date(r.created_at).toLocaleString()}
                                </span>
                              </div>
                              <Badge variant={r.status === 'pending' ? 'default' : 'secondary'}>{r.status}</Badge>
                            </div>
                            {r.reason && <p className="text-sm italic text-muted-foreground">"{r.reason}"</p>}
                            <div className="rounded-md border bg-muted/30 p-3">
                              {!r.target_exists ? (
                                <p className="text-sm text-muted-foreground">Content no longer exists.</p>
                              ) : (
                                <>
                                  {r.target_title && <p className="text-sm font-semibold mb-1">{r.target_title}</p>}
                                  <p className="text-sm text-muted-foreground">{r.target_body}</p>
                                  {r.target_author && <p className="text-xs text-muted-foreground mt-1">— {r.target_author.full_name}</p>}
                                </>
                              )}
                            </div>
                            {r.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" disabled={reportActionId === r.id} onClick={() => handleDismissReport(r)}>
                                  Dismiss
                                </Button>
                                <Button size="sm" variant="outline" disabled={reportActionId === r.id} onClick={() => handleResolveReport(r, false)}>
                                  Resolve (keep content)
                                </Button>
                                {r.target_exists && (
                                  <Button size="sm" variant="destructive" disabled={reportActionId === r.id} onClick={() => confirmDeleteReportedContent(r)}>
                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete content
                                  </Button>
                                )}
                              </div>
                            )}
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
              {referrals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Referral Leaderboard</CardTitle>
                    <CardDescription>Members who have brought in the most new members.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Referred</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referrals.map((r, i) => (
                          <TableRow key={r.referrer_id}>
                            <TableCell className="text-muted-foreground text-sm font-mono">#{i + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MemberAvatar name={r.referrer_name} size="sm" />
                                <div>
                                  <p className="text-sm font-medium">{r.referrer_name}</p>
                                  <p className="text-xs text-muted-foreground">{r.referrer_email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="success">{r.referral_count} member{r.referral_count !== 1 ? 's' : ''}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
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
                      <Combobox
                        value={broadcastForm.segment}
                        onChange={v => setBroadcastForm(f => ({ ...f, segment: v }))}
                        options={[
                          { value: 'all', label: `All Members (${members.length})` },
                          { value: 'active', label: `Active Members (${activeCount})` },
                          { value: 'inactive', label: `Inactive Members (${inactiveCount})` },
                        ]}
                        searchPlaceholder="Search segment…"
                      />
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

          {/* ══ SITE EDITOR ══ */}
          {tab === 'site_editor' && <SiteEditor flash={flash} />}

          {/* ══ SETTINGS ══ */}
          {tab === 'settings' && (
            <div className="space-y-6">
              <SectionHeader title="Settings" sub="Club configuration — changes take effect immediately" />

              {isLoading('settings')
                ? <Card><CardContent className="py-12"><Skeleton className="h-4 w-48 mb-4" /><Skeleton className="h-4 w-full mb-3" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
                : (
                  <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Club Info</CardTitle>
                        <CardDescription>Shown on the member dashboard and public pages.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Field label="Membership Price Display (e.g. ֏25,000/month)">
                          <Input value={settingsForm.membership_price_display} onChange={e => setSettingsForm(f => ({ ...f, membership_price_display: e.target.value }))} placeholder="e.g. ֏25,000/month" />
                        </Field>
                        <Field label="Club Location">
                          <Input value={settingsForm.club_location} onChange={e => setSettingsForm(f => ({ ...f, club_location: e.target.value }))} placeholder="e.g. Yerevan, Armenia" />
                        </Field>
                        <Field label="Instagram Handle">
                          <Input value={settingsForm.club_instagram} onChange={e => setSettingsForm(f => ({ ...f, club_instagram: e.target.value }))} placeholder="@hasmiksclub.am" />
                        </Field>
                        <Field label="Contact Email (shown on the Contact page)">
                          <Input type="email" value={settingsForm.club_email} onChange={e => setSettingsForm(f => ({ ...f, club_email: e.target.value }))} placeholder="hello@hasmiksclub.am" />
                        </Field>
                        <Field label="Contact Phone (shown on the Contact page)">
                          <Input type="tel" value={settingsForm.club_phone} onChange={e => setSettingsForm(f => ({ ...f, club_phone: e.target.value }))} placeholder="+374 …" />
                        </Field>
                        <Field label="Club Description (shown in club tab)">
                          <Textarea rows={3} value={settingsForm.club_description} onChange={e => setSettingsForm(f => ({ ...f, club_description: e.target.value }))} placeholder="A warm, intimate club for women in Yerevan..." />
                        </Field>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Membership & Applications</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="require_approval"
                            className="h-4 w-4 accent-primary cursor-pointer"
                            checked={settingsForm.require_approval === 'true'}
                            onChange={e => setSettingsForm(f => ({ ...f, require_approval: e.target.checked ? 'true' : 'false' }))}
                          />
                          <label htmlFor="require_approval" className="text-sm cursor-pointer">
                            Require admin approval for new registrations
                            <span className="block text-xs text-muted-foreground">New sign-ups will be held in "Applications" until you approve them</span>
                          </label>
                        </div>
                        <Field label="Telegram Invite URL (for member dashboard)">
                          <Input value={settingsForm.telegram_invite_url} onChange={e => setSettingsForm(f => ({ ...f, telegram_invite_url: e.target.value }))} placeholder="https://t.me/+…" />
                        </Field>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Gift Membership Pricing</CardTitle>
                        <CardDescription>Leave a tier blank to default to the monthly rate × months, with no bundle discount.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Field label="1 month (֏)">
                            <Input type="number" value={settingsForm.gift_price_1m} onChange={e => setSettingsForm(f => ({ ...f, gift_price_1m: e.target.value }))} placeholder="40000" />
                          </Field>
                          <Field label="3 months (֏)">
                            <Input type="number" value={settingsForm.gift_price_3m} onChange={e => setSettingsForm(f => ({ ...f, gift_price_3m: e.target.value }))} placeholder="120000" />
                          </Field>
                          <Field label="6 months (֏)">
                            <Input type="number" value={settingsForm.gift_price_6m} onChange={e => setSettingsForm(f => ({ ...f, gift_price_6m: e.target.value }))} placeholder="240000" />
                          </Field>
                          <Field label="12 months (֏)">
                            <Input type="number" value={settingsForm.gift_price_12m} onChange={e => setSettingsForm(f => ({ ...f, gift_price_12m: e.target.value }))} placeholder="480000" />
                          </Field>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Email Templates</CardTitle>
                        <CardDescription>
                          Use <code className="bg-muted px-1 rounded text-xs">{'{{name}}'}</code> for the member's first name.
                          Leave blank to use the system default.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Field label="Welcome Email Body (plain text, one paragraph per line)">
                          <Textarea rows={5} value={settingsForm.welcome_email_body} onChange={e => setSettingsForm(f => ({ ...f, welcome_email_body: e.target.value }))} placeholder="Welcome to Hasmik's Club, {{name}}! We're so happy you're here..." />
                        </Field>
                        <Field label="Event Reminder Email Body">
                          <Textarea rows={4} value={settingsForm.event_reminder_body} onChange={e => setSettingsForm(f => ({ ...f, event_reminder_body: e.target.value }))} placeholder="Just a reminder that your event is tomorrow, {{name}}..." />
                        </Field>
                        <Field label="Email Footer Text">
                          <Input value={settingsForm.email_footer} onChange={e => setSettingsForm(f => ({ ...f, email_footer: e.target.value }))} placeholder="You received this email because you are a member of Hasmik's Club." />
                        </Field>
                      </CardContent>
                    </Card>

                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={savingSettings}>
                        {savingSettings ? 'Saving…' : 'Save All Settings'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setSettingsForm({ ...DEFAULT_SETTINGS, ...adminSettings })}>
                        Reset
                      </Button>
                    </div>
                  </form>
                )
              }
            </div>
          )}

          {/* ══ ROLES & PERMISSIONS ══ */}
          {tab === 'roles' && (
            <div>
              <SectionHeader title="Roles & Permissions" sub="Assign roles and fine-tune permissions per member" />

              {/* Role edit modal */}
              {editingRole && (
                <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
                  onClick={() => setEditingRole(null)}>
                  <div style={{ background:'#fff', borderRadius:20, padding:'28px 28px', maxWidth:480, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.2)', maxHeight:'90vh', overflowY:'auto' }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                      <div>
                        <p style={{ fontWeight:700, fontSize:16, color:'#2c1a1a', marginBottom:2 }}>{editingRole.full_name}</p>
                        <p style={{ fontSize:12, color:'#888' }}>{editingRole.email}</p>
                      </div>
                      <button onClick={() => setEditingRole(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#bbb' }}>×</button>
                    </div>

                    {/* Role selector */}
                    <div style={{ marginBottom:20 }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'#888', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Role</p>
                      <div style={{ display:'flex', gap:8 }}>
                        {['member','moderator','admin'].map(r => (
                          <button key={r} onClick={() => setRoleForm(f => ({ role: r, permissions: null }))}
                            style={{ flex:1, padding:'8px 0', borderRadius:10, border:`2px solid ${roleForm.role===r ? 'hsl(var(--primary))' : '#e5e7eb'}`, background: roleForm.role===r ? 'hsl(var(--primary)/0.08)' : '#fafafa', fontWeight:600, fontSize:13, cursor:'pointer', color: roleForm.role===r ? 'hsl(var(--primary))' : '#555', textTransform:'capitalize', transition:'all 0.15s' }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Permissions */}
                    <div style={{ marginBottom:24 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <p style={{ fontSize:12, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>Permissions</p>
                        {roleForm.permissions !== null && (
                          <button onClick={resetToRoleDefaults} style={{ fontSize:11, color:'hsl(var(--primary))', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                            Reset to {roleForm.role} defaults
                          </button>
                        )}
                      </div>
                      {roleForm.permissions === null && (
                        <p style={{ fontSize:12, color:'#aaa', marginBottom:10, fontStyle:'italic' }}>Using {roleForm.role} role defaults</p>
                      )}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        {ALL_PERMISSIONS.map(perm => {
                          const effectivePerms = roleForm.permissions ?? ROLE_PERMISSIONS[roleForm.role] ?? []
                          const checked = effectivePerms.includes(perm)
                          const isDefault = (ROLE_PERMISSIONS[roleForm.role] || []).includes(perm)
                          return (
                            <label key={perm} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, cursor:'pointer', background: checked ? 'hsl(var(--primary)/0.06)' : '#f9f9f9', border:`1px solid ${checked ? 'hsl(var(--primary)/0.25)' : '#eee'}`, transition:'all 0.12s' }}>
                              <input type="checkbox" checked={checked} onChange={() => togglePermission(perm)} style={{ accentColor:'hsl(var(--primary))', width:14, height:14 }} />
                              <span style={{ fontSize:12, fontWeight:500, color: checked ? 'hsl(var(--primary))' : '#666' }}>
                                {PERMISSION_LABELS[perm]}
                              </span>
                              {isDefault && roleForm.permissions !== null && (
                                <span style={{ fontSize:9, color:'#bbb', marginLeft:'auto' }}>default</span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:10 }}>
                      <Button variant="outline" onClick={() => setEditingRole(null)} style={{ flex:1 }}>Cancel</Button>
                      <Button onClick={handleSaveRole} disabled={savingRole} style={{ flex:2 }}>
                        {savingRole ? 'Saving…' : 'Save Role & Permissions'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Users table */}
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading('roles') ? <TableSkeleton cols={4} /> : roles.map(u => {
                      const roleBadgeColor = u.role === 'admin' ? '#dc2626' : u.role === 'moderator' ? '#2563eb' : '#888'
                      const hasCustomPerms = u.permissions !== null
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <MemberAvatar name={u.full_name} />
                              <div>
                                <div style={{ fontWeight:600, fontSize:13 }}>{u.full_name}</div>
                                <div style={{ fontSize:11, color:'#999' }}>{u.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:9999, fontSize:11, fontWeight:700, background: roleBadgeColor + '18', color: roleBadgeColor, textTransform:'capitalize' }}>
                              {u.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div style={{ fontSize:11, color: hasCustomPerms ? 'hsl(var(--primary))' : '#aaa' }}>
                              {hasCustomPerms
                                ? `${u.effective_permissions.length} custom permission${u.effective_permissions.length !== 1 ? 's' : ''}`
                                : `Role defaults (${u.effective_permissions.length})`
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.id !== user?.id && (
                              <Button size="sm" variant="outline" onClick={() => openRoleEdit(u)}>Edit</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
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

          {/* ══ PAYMENTS ══ */}
          {tab === 'payments' && (() => {
            const depositedCount = payments.filter(p => p.status === 'deposited').length
            const refundedCount  = payments.filter(p => p.status === 'refunded').length
            const failedCount    = payments.filter(p => ['error', 'declined'].includes(p.status)).length
            const STATUS_BADGE = {
              deposited: 'success', approved: 'secondary', autoauthorized: 'secondary',
              started: 'muted', error: 'destructive', declined: 'destructive',
              refunded: 'secondary', void: 'muted',
            }
            return (
              <div className="space-y-6">
                <SectionHeader title="Payments" sub="Ameriabank vPOS — membership checkout attempts">
                  <Button variant="outline" size="sm" onClick={() => load('payments')}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh List
                  </Button>
                </SectionHeader>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard icon={CreditCard}   label="Total"      value={payments.length}  loading={isLoading('payments')} />
                  <KpiCard icon={CheckCircle2} label="Deposited"  value={depositedCount}   loading={isLoading('payments')} valueClass="text-emerald-600" />
                  <KpiCard icon={RotateCcw}    label="Refunded"   value={refundedCount}    loading={isLoading('payments')} />
                  <KpiCard icon={XCircle}      label="Failed"     value={failedCount}      loading={isLoading('payments')} valueClass={failedCount > 0 ? 'text-amber-600' : ''} />
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Card</TableHead>
                        <TableHead>Response</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading('payments')
                        ? <TableSkeleton cols={7} />
                        : payments.length === 0
                          ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No payment attempts yet</TableCell></TableRow>
                          : payments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs">#{p.order_id ?? '—'}</TableCell>
                              <TableCell className="text-sm">{p.amount} {p.currency === '051' ? 'AMD' : p.currency}</TableCell>
                              <TableCell><Badge variant={STATUS_BADGE[p.status] || 'muted'}>{p.status}</Badge></TableCell>
                              <TableCell className="text-muted-foreground text-xs">{p.card_number || '—'}</TableCell>
                              <TableCell className="text-muted-foreground text-xs max-w-[220px] truncate">{p.response_message || '—'}</TableCell>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{p.created_at ? fmtDateTime(p.created_at) : '—'}</TableCell>
                              <TableCell>
                                <div className="flex justify-end">
                                  <RowMenu items={[
                                    { icon: ScrollText, label: 'View logs', onClick: () => handleViewLogs(p) },
                                    { separator: true },
                                    { icon: RefreshCw, label: paymentActionId === p.id ? 'Refreshing…' : 'Refresh status', onClick: () => handleRefreshPayment(p) },
                                    { separator: true },
                                    { icon: RotateCcw, label: 'Refund', onClick: () => handleRefundPayment(p) },
                                    { icon: Ban, label: 'Cancel payment', danger: true, onClick: () => handleCancelPayment(p) },
                                  ]} />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      }
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )
          })()}

          {/* ══ ONE-TIMERS (guest event tickets) ══ */}
          {tab === 'one_timers' && (() => {
            const verifiedCount = guestTickets.filter(t => t.email_verified).length
            const paidCount     = guestTickets.filter(t => ['deposited', 'autoauthorized'].includes(t.status)).length
            const checkedInCount = guestTickets.filter(t => t.checked_in).length
            const STATUS_BADGE = {
              unverified: 'muted', started: 'muted', deposited: 'success', autoauthorized: 'success',
              error: 'destructive', declined: 'destructive', refunded: 'secondary', void: 'muted',
            }
            return (
              <div className="space-y-6">
                <SectionHeader title="One-Timers" sub="Guests who bought a single event ticket without an account">
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/scan')}>
                    <QrCode className="h-3.5 w-3.5" /> Open Scanner
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => load('one_timers')}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh List
                  </Button>
                </SectionHeader>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard icon={Ticket}      label="Total"        value={guestTickets.length} loading={isLoading('one_timers')} />
                  <KpiCard icon={BadgeCheck}  label="Email verified" value={verifiedCount}     loading={isLoading('one_timers')} />
                  <KpiCard icon={CreditCard}  label="Paid"         value={paidCount}           loading={isLoading('one_timers')} valueClass="text-emerald-600" />
                  <KpiCard icon={CheckCircle2} label="Checked in"  value={checkedInCount}       loading={isLoading('one_timers')} valueClass="text-primary" />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by name, email, phone, or event…"
                      value={guestTicketQuery}
                      onChange={e => setGuestTicketQuery(e.target.value)}
                    />
                  </div>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={guestTicketStatusFilter}
                    onChange={e => setGuestTicketStatusFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="unverified">Unverified</option>
                    <option value="started">Started</option>
                    <option value="deposited">Deposited</option>
                    <option value="error">Error</option>
                    <option value="declined">Declined</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Checked in</TableHead>
                        <TableHead>Purchased</TableHead>
                        <TableHead className="text-right">Logs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading('one_timers')
                        ? <TableSkeleton cols={10} />
                        : filteredGuestTickets.length === 0
                          ? <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">No one-time ticket purchases yet</TableCell></TableRow>
                          : filteredGuestTickets.map(t => (
                            <TableRow key={t.id}>
                              <TableCell className="font-medium text-sm">{t.full_name}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{t.email}</TableCell>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{t.phone || '—'}</TableCell>
                              <TableCell className="text-sm">{t.event_title || '—'}</TableCell>
                              <TableCell className="text-sm">{t.amount} AMD</TableCell>
                              <TableCell><Badge variant={STATUS_BADGE[t.status] || 'muted'}>{t.status}</Badge></TableCell>
                              <TableCell>{t.email_verified ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                              <TableCell>{t.checked_in ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{t.created_at ? fmtDateTime(t.created_at) : '—'}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => handleViewGuestLogs(t)} title="View payment logs"><ScrollText className="h-3.5 w-3.5" /></Button>
                              </TableCell>
                            </TableRow>
                          ))
                      }
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )
          })()}

          {/* ══ GIFT CARDS ══ */}
          {tab === 'gift_cards' && (() => {
            const paidCount = giftCards.filter(g => ['deposited', 'autoauthorized'].includes(g.status)).length
            const redeemedCount = giftCards.filter(g => g.redeemed).length
            const totalValue = giftCards.filter(g => ['deposited', 'autoauthorized'].includes(g.status)).reduce((s, g) => s + Number(g.amount), 0)
            const STATUS_BADGE = {
              unverified: 'muted', started: 'muted', deposited: 'success', autoauthorized: 'success',
              error: 'destructive', declined: 'destructive', refunded: 'secondary', void: 'muted',
            }
            return (
              <div className="space-y-6">
                <SectionHeader title="Gift Cards" sub="Membership and event-ticket gifts purchased for someone else">
                  <Button variant="outline" size="sm" onClick={() => load('gift_cards')}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh List
                  </Button>
                </SectionHeader>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard icon={Gift}         label="Total"     value={giftCards.length} loading={isLoading('gift_cards')} />
                  <KpiCard icon={CreditCard}   label="Paid"      value={paidCount}        loading={isLoading('gift_cards')} valueClass="text-emerald-600" />
                  <KpiCard icon={CheckCircle2} label="Redeemed"  value={redeemedCount}    loading={isLoading('gift_cards')} valueClass="text-primary" />
                  <KpiCard icon={Ticket}       label="Total Value" value={`֏${totalValue.toLocaleString()}`} loading={isLoading('gift_cards')} />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by giver or recipient name/email…"
                      value={giftCardQuery}
                      onChange={e => setGiftCardQuery(e.target.value)}
                    />
                  </div>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={giftCardTypeFilter}
                    onChange={e => setGiftCardTypeFilter(e.target.value)}
                  >
                    <option value="all">All types</option>
                    <option value="membership">Membership</option>
                    <option value="events">Events</option>
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={giftCardStatusFilter}
                    onChange={e => setGiftCardStatusFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="unverified">Unverified</option>
                    <option value="started">Started</option>
                    <option value="deposited">Deposited</option>
                    <option value="error">Error</option>
                    <option value="declined">Declined</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Giver</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Redeemed</TableHead>
                        <TableHead>Purchased</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading('gift_cards')
                        ? <TableSkeleton cols={8} />
                        : filteredGiftCards.length === 0
                          ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No gift cards purchased yet</TableCell></TableRow>
                          : filteredGiftCards.map(g => (
                            <TableRow key={g.id}>
                              <TableCell>
                                <div className="text-sm font-medium">{g.giver_name}{g.anonymous && <span className="text-muted-foreground font-normal"> (anon.)</span>}</div>
                                <div className="text-muted-foreground text-xs">{g.giver_email}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-medium">{g.recipient_name}</div>
                                <div className="text-muted-foreground text-xs">{g.recipient_email}</div>
                              </TableCell>
                              <TableCell className="text-sm">{g.gift_type === 'membership' ? `${g.duration_months}mo membership` : 'Event ticket(s)'}</TableCell>
                              <TableCell className="text-sm">֏{Number(g.amount).toLocaleString()}</TableCell>
                              <TableCell><Badge variant={STATUS_BADGE[g.status] || 'muted'}>{g.status}</Badge></TableCell>
                              <TableCell>{g.redeemed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{g.created_at ? fmtDateTime(g.created_at) : '—'}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline" size="sm"
                                  disabled={resendingGiftId === g.id || !['deposited', 'autoauthorized'].includes(g.status)}
                                  onClick={() => handleResendGift(g.id)}
                                >
                                  {resendingGiftId === g.id ? 'Sending…' : 'Resend'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                      }
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )
          })()}

        </main>
      </div>

      {/* ══ INLINE CONFIRM OVERLAY ══ */}
      {deleteTarget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 360, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#2c1a1a' }}>Are you sure?</p>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>{deleteTarget.label}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: deleteTarget.confirmLabel && deleteTarget.confirmLabel !== 'Delete' ? '#1a100a' : '#c0392b', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                onClick={() => { deleteTarget.onConfirm(); setDeleteTarget(null) }}
              >
                {deleteTarget.confirmLabel || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PAYMENT LOGS MODAL ══ */}
      {logsPayment && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setLogsPayment(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', maxWidth: 720, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#2c1a1a' }}>
                Payment Logs — Order #{logsPayment.order_id ?? '—'}
              </p>
              <button onClick={() => setLogsPayment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 20, wordBreak: 'break-all' }}>{logsPayment.payment_id || 'No PaymentID yet'}</p>

            {logsLoading ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '24px 0' }}>Loading…</p>
            ) : logsData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '24px 0' }}>No log entries yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {logsData.map(lg => (
                  <div key={lg.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: '14px 16px', background: lg.success ? '#f7fdf9' : '#fdf7f7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#2c1a1a' }}>
                        {lg.event.replace(/_/g, ' ')}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: lg.success ? '#e3f6ea' : '#fbe9e9', color: lg.success ? '#1a7a44' : '#c0392b' }}>
                          {lg.success ? 'success' : 'failed'}
                        </span>
                        <span style={{ fontSize: 11, color: '#999' }}>{lg.created_at ? new Date(lg.created_at).toLocaleString() : ''}</span>
                      </div>
                    </div>
                    {lg.request_payload && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 2 }}>Request</div>
                        <pre style={{ margin: 0, fontSize: 11, background: '#f7f5f2', borderRadius: 6, padding: '8px 10px', overflowX: 'auto' }}>{JSON.stringify(lg.request_payload, null, 2)}</pre>
                      </div>
                    )}
                    {lg.response_payload && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 2 }}>Response</div>
                        <pre style={{ margin: 0, fontSize: 11, background: '#f7f5f2', borderRadius: 6, padding: '8px 10px', overflowX: 'auto' }}>{JSON.stringify(lg.response_payload, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
