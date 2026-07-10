import '../admin.css'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Users, CalendarDays, BookOpen, CreditCard, Gift, Ticket,
  ClipboardList, StickyNote, Shield, Trash2, Link2, Mail,
  CheckCircle2, Images, ScrollText,
} from 'lucide-react'

import { Button }   from '../components/ui/button'
import { Badge }    from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Skeleton } from '../components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table'
import { KpiCard, MemberAvatar, fmtDate, fmtDateTime } from '../components/ui/AdminShared'
import {
  adminGetMemberDetail, adminUpdateMember, adminDeleteMember,
  adminCancelAutoRenew, adminGetPaymentLogs,
} from '../api/admin'

function statusVariant(s) {
  return s === 'active' ? 'success' : s === 'past_due' ? 'warning' : 'muted'
}
function payStatusVariant(s) {
  return ['deposited', 'approved'].includes(s) ? 'success'
    : ['declined', 'error', 'void'].includes(s) ? 'destructive' : 'muted'
}
function fmtAmount(amount) {
  return `${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })} AMD`
}

function Section({ icon: Icon, title, sub, count, children, actions }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {Icon && <Icon className="h-4 w-4 text-primary" />}
              {title}
              {count !== undefined && <Badge variant="muted" className="text-[10px] px-1.5">{count}</Badge>}
            </CardTitle>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-words">{children ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  )
}

function EmptyNote({ children }) {
  return <p className="text-sm text-muted-foreground text-center py-6">{children}</p>
}

export default function AdminMemberDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [member, setMember]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [toast, setToast]           = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [savingNotes, setSavingNotes]   = useState(false)
  const [confirm, setConfirm]       = useState(null) // { label, confirmLabel, onConfirm }
  const [logsPayment, setLogsPayment] = useState(null)
  const [logsData, setLogsData]       = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  const flash = (msg, isError = false) => {
    setToast({ msg, isError })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminGetMemberDetail(id)
      setMember(data)
      setNotesDraft(data.admin_notes || '')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load member')
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => { load() }, [load])

  const toggleMembership = async () => {
    const next = member.membership_status === 'active' ? 'inactive' : 'active'
    try {
      await adminUpdateMember(member.id, { membership_status: next })
      setMember(m => ({ ...m, membership_status: next }))
      flash(`${member.full_name} → ${next}`)
    } catch { flash('Update failed', true) }
  }

  const handleCancelAutoRenew = () => {
    setConfirm({
      label: `Turn off auto-renew for ${member.full_name}? Their membership stays active until the current period ends.`,
      confirmLabel: 'Turn off',
      onConfirm: async () => {
        await adminCancelAutoRenew(member.id)
        setMember(m => ({ ...m, binding_active: false }))
        flash('Auto-renew turned off')
      },
    })
  }

  const handleDelete = () => {
    setConfirm({
      label: `Delete ${member.full_name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await adminDeleteMember(member.id)
        navigate('/admin')
      },
    })
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      await adminUpdateMember(member.id, { admin_notes: notesDraft })
      setMember(m => ({ ...m, admin_notes: notesDraft }))
      setEditingNotes(false)
      flash('Notes saved')
    } catch { flash('Failed to save notes', true) }
    finally { setSavingNotes(false) }
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

  const attended = member?.rsvps?.filter(r => r.checked_in).length ?? 0

  return (
    // .admin-shell is display:flex (row) in App.css for AdminPage's sidebar layout — force column here
    <div className="admin-shell min-h-screen bg-background" style={{ flexDirection: 'column' }}>
      {/* top bar */}
      {/* inline styles — the scoped admin Tailwind build lacks bg-white/sticky (see GuestScanPage) */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid hsl(var(--border))', background: '#fff', position: 'sticky', top: 0, zIndex: 20 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Button>
      </header>

      {/* minWidth 0 — as a flex child of .admin-shell, main otherwise refuses to shrink below its widest table */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6" style={{ minWidth: 0, width: '100%' }}>
        {loading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : error ? (
          <Card><CardContent className="py-12 text-center text-destructive text-sm">{error}</CardContent></Card>
        ) : member && (
          <>
            {/* header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                {member.photo_url
                  ? <img src={member.photo_url} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                  : <span className="[&>span]:w-14 [&>span]:h-14 [&>span]:text-lg"><MemberAvatar name={member.full_name} /></span>}
                <div>
                  <h1 className="font-serif text-3xl font-light leading-tight flex items-center gap-2 flex-wrap">
                    {member.full_name}
                    {member.is_admin && <Badge variant="secondary">Admin</Badge>}
                  </h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant={statusVariant(member.membership_status)}>{member.membership_status}</Badge>
                    <span className="text-xs text-muted-foreground">Member since {fmtDate(member.joined_at)}</span>
                    <span className="text-xs text-muted-foreground">· #{member.id}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant={member.membership_status === 'active' ? 'outline' : 'success'} size="sm" onClick={toggleMembership}>
                  {member.membership_status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
                {member.binding_active && (
                  <Button variant="outline" size="sm" onClick={handleCancelAutoRenew}>
                    <CreditCard className="h-3.5 w-3.5" /> Cancel auto-renew
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={CalendarDays} label="Events attended" value={`${attended}/${member.rsvps.length}`} />
              <KpiCard icon={BookOpen}     label="Content unlocked" value={member.unlocked_content.length} />
              <KpiCard icon={CreditCard}   label="Payments" value={member.payments.length} />
              <KpiCard icon={Users}        label="Referrals" value={member.referrals.length} valueClass="text-primary" />
            </div>

            {/* identity & contact */}
            <Section icon={Mail} title="Identity & Contact">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                <InfoRow label="Email">{member.email}</InfoRow>
                <InfoRow label="Phone">{member.phone}</InfoRow>
                <InfoRow label="WhatsApp">{member.whatsapp}</InfoRow>
                <InfoRow label="Telegram">{member.telegram_username ? `@${member.telegram_username}` : member.telegram_id ? `id ${member.telegram_id}` : null}</InfoRow>
                <InfoRow label="Facebook">{member.facebook_url && <a href={member.facebook_url} target="_blank" rel="noreferrer" className="text-primary underline break-all">{member.facebook_url}</a>}</InfoRow>
                <InfoRow label="Language">{member.lang_pref === 'hy' ? 'Հայերեն' : 'English'}</InfoRow>
                <InfoRow label="Google account">{member.google_id ? 'Linked' : 'Not linked'}</InfoRow>
                <InfoRow label="Email verified">{member.is_verified ? 'Yes' : 'No'}</InfoRow>
                <InfoRow label="In directory">{member.show_in_directory ? 'Yes' : 'Hidden'}</InfoRow>
                <InfoRow label="Onboarding">{member.onboarding_completed ? 'Completed' : 'Not completed'}</InfoRow>
                <InfoRow label="Application">{member.application_status}</InfoRow>
                <InfoRow label="Last updated">{member.updated_at ? fmtDateTime(member.updated_at) : null}</InfoRow>
              </div>
              {member.bio && (
                <div className="mt-4 pt-4 border-t">
                  <InfoRow label="Bio">{member.bio}</InfoRow>
                </div>
              )}
              {member.application_message && (
                <div className="mt-4 pt-4 border-t">
                  <InfoRow label="Application message">{member.application_message}</InfoRow>
                </div>
              )}
            </Section>

            {/* membership & billing */}
            <Section icon={CreditCard} title="Membership & Billing">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                <InfoRow label="Status"><Badge variant={statusVariant(member.membership_status)}>{member.membership_status}</Badge></InfoRow>
                <InfoRow label="Auto-renew">{member.binding_active ? 'Active' : 'Off'}</InfoRow>
                <InfoRow label="Next billing">{member.next_billing_date ? fmtDate(member.next_billing_date) : null}</InfoRow>
                <InfoRow label="Gift expires">{member.membership_expires_at ? fmtDate(member.membership_expires_at) : null}</InfoRow>
                <InfoRow label="Renewal attempts">{member.renewal_attempts || '0'}</InfoRow>
                <InfoRow label="Card required by">{member.card_required_by ? <span className="text-amber-600">{fmtDate(member.card_required_by)}</span> : null}</InfoRow>
                <InfoRow label="Card holder ID"><span className="font-mono text-xs">{member.card_holder_id}</span></InfoRow>
              </div>
            </Section>

            {/* role & access + notes */}
            <Section icon={Shield} title="Role & Access">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                <InfoRow label="Role">{member.role}</InfoRow>
                <InfoRow label="Admin">{member.is_admin ? 'Yes' : 'No'}</InfoRow>
                <InfoRow label="Custom permissions">{member.permissions ? <span className="font-mono text-xs break-all">{member.permissions}</span> : 'Role defaults'}</InfoRow>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <StickyNote className="h-3 w-3" /> Private notes
                  </span>
                  {!editingNotes && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                      {member.admin_notes ? 'Edit' : 'Add'}
                    </Button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={3}
                      placeholder="e.g. paid by bank transfer, referred by Hasmik…"
                      value={notesDraft}
                      onChange={e => setNotesDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveNotes} disabled={savingNotes}>{savingNotes ? 'Saving…' : 'Save'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingNotes(false); setNotesDraft(member.admin_notes || '') }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{member.admin_notes || <span className="text-muted-foreground">No notes yet</span>}</p>
                )}
              </div>
            </Section>

            {/* RSVPs */}
            <Section icon={CalendarDays} title="Events" count={member.rsvps.length}>
              {member.rsvps.length === 0 ? <EmptyNote>No event RSVPs yet</EmptyNote> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Event</TableHead><TableHead>Date</TableHead><TableHead>RSVP'd</TableHead><TableHead>Attendance</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.rsvps.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.event_title}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fmtDateTime(r.event_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fmtDate(r.created_at)}</TableCell>
                        <TableCell>{r.checked_in
                          ? <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Checked in</Badge>
                          : <Badge variant="muted">Not checked in</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>

            {/* unlocked content */}
            <Section icon={BookOpen} title="Unlocked Content" count={member.unlocked_content.length}>
              {member.unlocked_content.length === 0 ? <EmptyNote>Nothing unlocked yet</EmptyNote> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Unlocked</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.unlocked_content.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium text-sm">{u.title}</TableCell>
                        <TableCell><Badge variant="muted">{u.type}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fmtDate(u.unlocked_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>

            {/* profile photos */}
            <Section icon={Images} title="Profile Photos" count={member.profile_photos.length}>
              {member.profile_photos.length === 0 ? <EmptyNote>No profile photos</EmptyNote> : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {member.profile_photos.map(p => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} alt="" className="w-full aspect-square object-cover rounded-lg border" />
                    </a>
                  ))}
                </div>
              )}
            </Section>

            {/* payments */}
            <Section icon={CreditCard} title="Payment History" count={member.payments.length}>
              {member.payments.length === 0 ? <EmptyNote>No membership payments</EmptyNote> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Date</TableHead><TableHead>Order</TableHead><TableHead>Amount</TableHead><TableHead>Card</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Logs</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground text-sm">{p.created_at ? fmtDateTime(p.created_at) : '—'}</TableCell>
                        <TableCell className="text-sm">#{p.order_id ?? '—'}</TableCell>
                        <TableCell className="font-medium text-sm">{fmtAmount(p.amount)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">{p.card_number || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={payStatusVariant(p.status)}>{p.status}</Badge>
                          {p.response_message && <div className="text-[11px] text-muted-foreground mt-0.5">{p.response_message}</div>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleViewLogs(p)}><ScrollText className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>

            {/* gift cards */}
            <Section icon={Gift} title="Gift Cards Given" count={member.gift_cards_given.length}
              sub="Matched by this member's email — gift purchases don't require an account">
              {member.gift_cards_given.length === 0 ? <EmptyNote>No gifts given</EmptyNote> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Recipient</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.gift_cards_given.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{g.recipient_name}</div>
                          <div className="text-xs text-muted-foreground">{g.recipient_email}</div>
                        </TableCell>
                        <TableCell><Badge variant="muted">{g.gift_type === 'membership' ? `${g.duration_months} mo membership` : 'events'}</Badge></TableCell>
                        <TableCell className="font-medium text-sm">{fmtAmount(g.amount)}</TableCell>
                        <TableCell><Badge variant={payStatusVariant(g.status)}>{g.status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{g.created_at ? fmtDate(g.created_at) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>

            <Section icon={Gift} title="Gift Cards Received" count={member.gift_cards_received.length}>
              {member.gift_cards_received.length === 0 ? <EmptyNote>No gifts received</EmptyNote> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>From</TableHead><TableHead>Type</TableHead><TableHead>Redeemed</TableHead><TableHead>Date</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.gift_cards_received.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{g.giver_name}</div>
                          <div className="text-xs text-muted-foreground">{g.giver_email}</div>
                        </TableCell>
                        <TableCell><Badge variant="muted">{g.gift_type === 'membership' ? `${g.duration_months} mo membership` : 'events'}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{g.redeemed_at ? fmtDateTime(g.redeemed_at) : '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{g.created_at ? fmtDate(g.created_at) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>

            {/* guest tickets */}
            <Section icon={Ticket} title="One-Time Tickets" count={member.guest_tickets_by_email.length}
              sub="Matched by email — guest tickets aren't linked to member accounts, so tickets bought under a different email won't appear here">
              {member.guest_tickets_by_email.length === 0 ? <EmptyNote>No guest tickets under this email</EmptyNote> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Event</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Attendance</TableHead><TableHead>Date</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.guest_tickets_by_email.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-sm">{t.event_title}</TableCell>
                        <TableCell className="text-sm">{fmtAmount(t.amount)}</TableCell>
                        <TableCell><Badge variant={payStatusVariant(t.status)}>{t.status}</Badge></TableCell>
                        <TableCell>{t.checked_in ? <Badge variant="success">Checked in</Badge> : <Badge variant="muted">—</Badge>}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{t.created_at ? fmtDate(t.created_at) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>

            {/* referrals */}
            <Section icon={Link2} title="Referrals" count={member.referrals.length}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
                <InfoRow label="Referral code"><span className="font-mono">{member.referral_code}</span></InfoRow>
                <InfoRow label="Referred by">
                  {member.referred_by_id ? (
                    <Link to={`/admin/members/${member.referred_by_id}`} className="text-primary underline">
                      {member.referred_by_name || `Member #${member.referred_by_id}`}
                    </Link>
                  ) : null}
                </InfoRow>
              </div>
              {member.referrals.length === 0 ? <EmptyNote>Hasn't referred anyone yet</EmptyNote> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Member</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.referrals.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link to={`/admin/members/${r.id}`} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                            <MemberAvatar name={r.full_name} size="sm" /> {r.full_name}
                          </Link>
                          {r.email && <div className="text-xs text-muted-foreground ml-8">{r.email}</div>}
                        </TableCell>
                        <TableCell><Badge variant={statusVariant(r.membership_status)}>{r.membership_status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.joined_at ? fmtDate(r.joined_at) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>

            {/* audit log */}
            <Section icon={ClipboardList} title="Admin Audit Log" count={member.audit_log.length}
              sub="Admin actions taken on this member's account">
              {member.audit_log.length === 0 ? <EmptyNote>No admin actions recorded</EmptyNote> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>When</TableHead><TableHead>Admin</TableHead><TableHead>Action</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.audit_log.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{a.created_at ? fmtDateTime(a.created_at) : '—'}</TableCell>
                        <TableCell className="text-sm">{a.admin_name || (a.admin_id ? `#${a.admin_id}` : 'System')}</TableCell>
                        <TableCell className="text-sm break-all">{a.action}{a.details ? ` — ${a.details}` : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>
          </>
        )}
      </main>

      {/* confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-[9999] bg-black/45 flex items-center justify-center p-5" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-foreground mb-5">{confirm.label}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={async () => {
                try { await confirm.onConfirm() } catch (e) { flash(e?.response?.data?.detail || 'Action failed', true) }
                setConfirm(null)
              }}>{confirm.confirmLabel || 'Confirm'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* payment logs modal — same shape as the admin Payments tab modal */}
      {logsPayment && (
        <div className="fixed inset-0 z-[9999] bg-black/45 flex items-center justify-center p-5" onClick={() => setLogsPayment(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-1">
              <p className="font-bold text-base">Payment Logs — Order #{logsPayment.order_id ?? '—'}</p>
              <button onClick={() => setLogsPayment(null)} className="text-2xl leading-none text-muted-foreground">×</button>
            </div>
            {logsLoading ? (
              <p className="text-center text-muted-foreground py-6">Loading…</p>
            ) : logsData.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No log entries yet</p>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                {logsData.map(lg => (
                  <div key={lg.id} className={`border rounded-lg p-4 ${lg.success ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
                    <div className="flex justify-between items-center mb-2 flex-wrap gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide">{lg.event.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={lg.success ? 'success' : 'destructive'}>{lg.success ? 'success' : 'failed'}</Badge>
                        <span className="text-[11px] text-muted-foreground">{lg.created_at ? new Date(lg.created_at).toLocaleString() : ''}</span>
                      </div>
                    </div>
                    {lg.request_payload && (
                      <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-x-auto mb-2">{JSON.stringify(lg.request_payload, null, 2)}</pre>
                    )}
                    {lg.response_payload && (
                      <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-x-auto">{JSON.stringify(lg.response_payload, null, 2)}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2.5 rounded-lg text-sm text-white shadow-lg ${toast.isError ? 'bg-destructive' : 'bg-foreground'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
