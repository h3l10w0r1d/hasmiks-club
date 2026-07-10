import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  ComposedChart, LineChart, BarChart, PieChart,
  Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { adminGetAnalytics } from '../api/admin'

// ── palette ──────────────────────────────────────────────────────────────────
const ROSE   = '#c0394b'
const PEACH  = '#f5c0c0'
const DEEP   = '#2c1a1a'
const GREEN  = '#2ecc71'
const AMBER  = '#f39c12'
const BLUE   = '#3498db'
const GRAY   = '#95a5a6'
const PIE_COLORS = [ROSE, PEACH, '#e67e73', '#d45f6a']

// ── small helpers ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,.06)', display: 'flex',
      flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: color || DEEP }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: GRAY }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 20, marginTop: 48 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: DEEP }}>{children}</h3>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 13, color: GRAY }}>{sub}</p>}
    </div>
  )
}

const FMT = { style: 'decimal', maximumFractionDigits: 1 }
function pct(v) { return v != null ? `${v}%` : '—' }
function amd(v) { return `֏${Math.round(v ?? 0).toLocaleString()}` }

const PAYMENT_STATUS_COLORS = {
  deposited: GREEN, autoauthorized: GREEN, approved: BLUE, started: GRAY,
  declined: ROSE, void: ROSE, error: ROSE, refunded: AMBER,
}

function StatusPill({ status }) {
  const colors = { active: GREEN, inactive: ROSE, cancelled: GRAY }
  return (
    <span style={{
      background: colors[status] + '22', color: colors[status],
      borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {status}
    </span>
  )
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #f0e0e5', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, color: DEEP }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ margin: '2px 0', color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── sub-sections ─────────────────────────────────────────────────────────────

function OverviewCards({ d }) {
  const cards = [
    { label: 'Total Members', value: d.total_members, color: DEEP },
    { label: 'Active Members', value: d.active_members, color: GREEN,
      sub: `${pct(d.activation_rate)} activation rate` },
    { label: 'Inactive', value: d.inactive_members, color: ROSE },
    { label: 'New This Month', value: d.new_this_month, color: BLUE,
      sub: d.mom_growth != null ? `${d.mom_growth > 0 ? '+' : ''}${d.mom_growth}% vs last month` : null },
    { label: 'Total Events', value: d.total_events,
      sub: `${d.upcoming_events} upcoming` },
    { label: 'Total RSVPs', value: d.total_rsvps,
      sub: `${pct(d.avg_fill_rate)} avg fill rate` },
    { label: 'Content Items', value: d.total_content,
      sub: `${d.total_unlocks} total unlocks` },
    { label: 'Engagement Rate', value: pct(d.engagement_rate), color: AMBER,
      sub: `${d.members_with_rsvp} members ever RSVPd` },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
      {cards.map(c => <KpiCard key={c.label} {...c} />)}
    </div>
  )
}

function MemberGrowthChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e8ea" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <Tooltip content={<TT />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="new_members" name="New Members" fill={PEACH} radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" dataKey="cumulative" name="Total (cumulative)" stroke={ROSE} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function RsvpTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e8ea" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<TT />} />
        <Bar dataKey="rsvps" name="RSVPs" fill={ROSE} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function StatusPie({ active, inactive }) {
  const data = [
    { name: 'Active', value: active },
    { name: 'Inactive', value: inactive },
  ]
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
          dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
          labelLine={false}>
          <Cell fill={GREEN} />
          <Cell fill={PEACH} />
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

function CohortTable({ cohorts }) {
  if (!cohorts.length) return <p style={{ color: GRAY, fontSize: 13 }}>Not enough data yet.</p>
  return (
    <table className="admin-table" style={{ fontSize: 13 }}>
      <thead>
        <tr><th>Cohort</th><th>Joined</th><th>Active</th><th>Inactive</th><th>Activation %</th></tr>
      </thead>
      <tbody>
        {cohorts.map(c => (
          <tr key={c.month}>
            <td><strong>{c.month}</strong></td>
            <td>{c.total}</td>
            <td style={{ color: GREEN }}>{c.active}</td>
            <td style={{ color: ROSE }}>{c.inactive}</td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, background: '#f0e0e5', borderRadius: 4, height: 6 }}>
                  <div style={{ width: `${c.activation_rate}%`, background: GREEN, borderRadius: 4, height: 6 }} />
                </div>
                <span>{c.activation_rate}%</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EventsChart({ events }) {
  const data = [...events].sort((a, b) => a.fill_rate - b.fill_rate)
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e8ea" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="title" width={160} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v}%`, 'Fill rate']} />
        <Bar dataKey="fill_rate" name="Fill rate %" radius={[0, 4, 4, 0]}
          label={{ position: 'right', formatter: v => `${v}%`, fontSize: 11 }}>
          {data.map((entry) => (
            <Cell key={entry.id} fill={entry.fill_rate >= 80 ? GREEN : entry.fill_rate >= 50 ? AMBER : ROSE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function EventsTable({ events }) {
  return (
    <table className="admin-table" style={{ fontSize: 13 }}>
      <thead>
        <tr><th>Event</th><th>Date</th><th>Seats</th><th>RSVPs</th><th>Fill</th><th>Status</th></tr>
      </thead>
      <tbody>
        {events.map(e => (
          <tr key={e.id}>
            <td><strong>{e.title}</strong></td>
            <td className="admin-td-muted">{new Date(e.event_date).toLocaleDateString()}</td>
            <td>{e.max_seats}</td>
            <td>{e.rsvp_count}</td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                <div style={{ flex: 1, background: '#f0e0e5', borderRadius: 4, height: 6 }}>
                  <div style={{
                    width: `${Math.min(e.fill_rate, 100)}%`,
                    background: e.fill_rate >= 80 ? GREEN : e.fill_rate >= 50 ? AMBER : ROSE,
                    borderRadius: 4, height: 6,
                  }} />
                </div>
                <span style={{ fontSize: 12, minWidth: 36 }}>{e.fill_rate}%</span>
              </div>
            </td>
            <td>
              <span style={{ fontSize: 12, color: e.is_past ? GRAY : BLUE, fontWeight: 600 }}>
                {e.is_past ? 'Past' : 'Upcoming'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ContentChart({ data }) {
  const top10 = data.slice(0, 10)
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 44)}>
      <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e8ea" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="title" width={180} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="unlock_count" name="Unlocks" fill={ROSE} radius={[0, 4, 4, 0]}
          label={{ position: 'right', fontSize: 11 }}>
          {top10.map((_, i) => (
            <Cell key={i} fill={i === 0 ? DEEP : i < 3 ? ROSE : PEACH} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function TopMembersTable({ members }) {
  return (
    <table className="admin-table" style={{ fontSize: 13 }}>
      <thead>
        <tr><th>#</th><th>Member</th><th>Status</th><th>RSVPs</th><th>Unlocks</th><th>Score</th></tr>
      </thead>
      <tbody>
        {members.map((m, i) => (
          <tr key={m.id}>
            <td style={{ color: i < 3 ? ROSE : GRAY, fontWeight: 700 }}>{i + 1}</td>
            <td>
              <div style={{ fontWeight: 600 }}>{m.full_name}</div>
              <div style={{ fontSize: 11, color: GRAY }}>{m.email}</div>
            </td>
            <td><StatusPill status={m.membership_status} /></td>
            <td>{m.rsvp_count}</td>
            <td>{m.unlock_count}</td>
            <td>
              <span style={{
                background: ROSE + '22', color: ROSE, borderRadius: 20,
                padding: '2px 10px', fontWeight: 700, fontSize: 13,
              }}>{m.score}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DisengagedTable({ members, title, emptyMsg }) {
  if (!members.length) return <p style={{ color: GRAY, fontSize: 13 }}>{emptyMsg}</p>
  return (
    <table className="admin-table" style={{ fontSize: 13 }}>
      <thead>
        <tr><th>Member</th><th>Status</th><th>Joined</th><th>Days Since Join</th><th>RSVPs</th></tr>
      </thead>
      <tbody>
        {members.map(m => (
          <tr key={m.id}>
            <td>
              <div style={{ fontWeight: 600 }}>{m.full_name}</div>
              <div style={{ fontSize: 11, color: GRAY }}>{m.email}</div>
            </td>
            <td><StatusPill status={m.membership_status} /></td>
            <td className="admin-td-muted">{new Date(m.joined_at).toLocaleDateString()}</td>
            <td>
              <span style={{ color: m.days_since_join > 60 ? ROSE : AMBER, fontWeight: 600 }}>
                {m.days_since_join}d
              </span>
            </td>
            <td>{m.rsvp_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AtRiskTable({ members }) {
  if (!members.length) return <p style={{ color: GRAY, fontSize: 13 }}>No at-risk active members. Great!</p>
  return (
    <table className="admin-table" style={{ fontSize: 13 }}>
      <thead>
        <tr><th>Member</th><th>Last RSVP</th></tr>
      </thead>
      <tbody>
        {members.map(m => (
          <tr key={m.id}>
            <td>
              <div style={{ fontWeight: 600 }}>{m.full_name}</div>
              <div style={{ fontSize: 11, color: GRAY }}>{m.email}</div>
            </td>
            <td>
              {m.last_rsvp_days_ago != null
                ? <span style={{ color: m.last_rsvp_days_ago > 90 ? ROSE : AMBER, fontWeight: 600 }}>
                    {m.last_rsvp_days_ago}d ago
                  </span>
                : <span style={{ color: ROSE, fontWeight: 600 }}>Never</span>
              }
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ActivityFeed({ items }) {
  function timeAgo(isoStr) {
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }
  const typeColor = { rsvp: BLUE, join: GREEN, unlock: ROSE }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: '#fff', borderRadius: 10, padding: '10px 14px',
          boxShadow: '0 1px 4px rgba(0,0,0,.05)',
        }}>
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          <span style={{ flex: 1, fontSize: 13, color: DEEP }}>{item.text}</span>
          <span style={{ fontSize: 11, color: GRAY, whiteSpace: 'nowrap' }}>{timeAgo(item.at)}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: typeColor[item.type],
            background: typeColor[item.type] + '20', borderRadius: 10,
            padding: '2px 8px', textTransform: 'uppercase',
          }}>{item.type}</span>
        </div>
      ))}
    </div>
  )
}

function RevenueTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e8ea" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={amd} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={amd} />
        <Tooltip content={<TT />} formatter={amd} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="membership" name="Membership" stackId="rev" fill={ROSE} />
        <Bar yAxisId="left" dataKey="guest_tickets" name="Guest Tickets" stackId="rev" fill={PEACH} radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" dataKey="cumulative" name="Cumulative Total" stroke={DEEP} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function PaymentStatusChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e8ea" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={amd} />
        <YAxis type="category" dataKey="status" width={90} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v, name) => name === 'amount' ? [amd(v), 'Amount'] : [v, 'Count']} />
        <Bar dataKey="amount" name="amount" radius={[0, 4, 4, 0]}
          label={{ position: 'right', formatter: (v) => amd(v), fontSize: 11 }}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={PAYMENT_STATUS_COLORS[entry.status] || GRAY} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function TopPayingMembersTable({ members }) {
  if (!members.length) return <p style={{ color: GRAY, fontSize: 13 }}>No paid transactions yet.</p>
  return (
    <table className="admin-table" style={{ fontSize: 13 }}>
      <thead>
        <tr><th>#</th><th>Member</th><th>Payments</th><th>Lifetime Value</th></tr>
      </thead>
      <tbody>
        {members.map((m, i) => (
          <tr key={m.id}>
            <td style={{ color: i < 3 ? ROSE : GRAY, fontWeight: 700 }}>{i + 1}</td>
            <td>
              <div style={{ fontWeight: 600 }}>{m.full_name}</div>
              <div style={{ fontSize: 11, color: GRAY }}>{m.email}</div>
            </td>
            <td>{m.payment_count}</td>
            <td><strong style={{ color: ROSE }}>{amd(m.lifetime_value)}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RevenueByEventTable({ rows }) {
  if (!rows.length) return <p style={{ color: GRAY, fontSize: 13 }}>No one-time ticket sales yet.</p>
  return (
    <table className="admin-table" style={{ fontSize: 13 }}>
      <thead>
        <tr><th>Event</th><th>Tickets Sold</th><th>Revenue</th></tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.event_id}>
            <td><strong>{r.title}</strong></td>
            <td>{r.ticket_count}</td>
            <td><strong style={{ color: ROSE }}>{amd(r.revenue)}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TransactionStatusPill({ status }) {
  const color = PAYMENT_STATUS_COLORS[status] || GRAY
  return (
    <span style={{ background: color + '22', color, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
      {status}
    </span>
  )
}

function TransactionsTable({ rows, emptyMsg }) {
  if (!rows.length) return <p style={{ color: GRAY, fontSize: 13 }}>{emptyMsg}</p>
  return (
    <table className="admin-table" style={{ fontSize: 13 }}>
      <thead>
        <tr><th>Date</th><th>Payer</th><th>Type</th><th>Amount</th><th>Status</th></tr>
      </thead>
      <tbody>
        {rows.map(t => (
          <tr key={t.id}>
            <td className="admin-td-muted">{new Date(t.created_at).toLocaleString()}</td>
            <td>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: GRAY }}>{t.email}</div>
            </td>
            <td>
              <span style={{ fontSize: 11, background: '#f0e0e5', color: ROSE, borderRadius: 10, padding: '2px 8px' }}>
                {t.type === 'membership' ? 'Membership' : 'Guest Ticket'}
              </span>
            </td>
            <td><strong>{amd(t.amount)}</strong></td>
            <td><TransactionStatusPill status={t.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [section, setSection] = useState('overview')

  useEffect(() => {
    adminGetAnalytics()
      .then(setData)
      .catch(() => setErr('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  const NAV = [
    { id: 'overview',   label: 'Overview' },
    { id: 'financials', label: 'Financials' },
    { id: 'members',    label: 'Members' },
    { id: 'events',     label: 'Events' },
    { id: 'content',    label: 'Content' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'activity',   label: 'Activity' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div style={{ color: ROSE, fontSize: 16 }}>Loading analytics...</div>
    </div>
  )
  if (err || !data) return <p style={{ color: ROSE }}>{err || 'No data'}</p>

  const { overview, member_growth, cohorts, events, rsvp_trend,
          content_engagement, top_members, disengaged, at_risk, recent_activity, financials } = data

  return (
    <div>
      {/* section nav */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => setSection(n.id)}
            style={{
              padding: '7px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: section === n.id ? ROSE : '#f5ecee',
              color: section === n.id ? '#fff' : DEEP,
              transition: 'all .15s',
            }}
          >
            {n.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {section === 'overview' && (
        <div>
          <h2 className="dash-section-title">Key Metrics</h2>
          <OverviewCards d={overview} />

          <SectionTitle sub="New members registered per month + cumulative total">
            Member Growth — Last 12 Months
          </SectionTitle>
          <MemberGrowthChart data={member_growth} />

          <SectionTitle sub="Number of RSVPs created per month">
            RSVP Trend — Last 12 Months
          </SectionTitle>
          <RsvpTrendChart data={rsvp_trend} />
        </div>
      )}

      {/* ── FINANCIALS ── */}
      {section === 'financials' && (
        <div>
          <h2 className="dash-section-title">Revenue</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            <KpiCard label="Total Revenue" value={amd(financials.overview.total_revenue)} color={ROSE} />
            <KpiCard label="This Month" value={amd(financials.overview.revenue_this_month)} color={GREEN}
              sub={financials.overview.revenue_mom_growth != null
                ? `${financials.overview.revenue_mom_growth > 0 ? '+' : ''}${financials.overview.revenue_mom_growth}% vs last month`
                : null} />
            <KpiCard label="Membership Revenue" value={amd(financials.overview.membership_revenue)} color={DEEP} />
            <KpiCard label="Guest Ticket Revenue" value={amd(financials.overview.guest_ticket_revenue)} color={AMBER} />
            <KpiCard label="Paid Transactions" value={financials.overview.total_paid_transactions} color={BLUE}
              sub={`${amd(financials.overview.avg_transaction_value)} avg`} />
            <KpiCard label="Conversion Rate" value={pct(financials.overview.conversion_rate)}
              color={financials.overview.conversion_rate >= 80 ? GREEN : financials.overview.conversion_rate >= 50 ? AMBER : ROSE}
              sub={`${financials.overview.total_failed_transactions} failed`} />
            <KpiCard label="Refunded" value={amd(financials.overview.total_refunded)} color={ROSE} />
          </div>

          <SectionTitle sub="Membership vs one-time guest ticket revenue, plus running total — last 12 months">
            Revenue Trend
          </SectionTitle>
          <RevenueTrendChart data={financials.revenue_trend} />

          <SectionTitle sub="Every payment attempt across both membership and guest-ticket checkouts, by outcome">
            Payment Funnel
          </SectionTitle>
          {financials.payment_status_breakdown.length
            ? <PaymentStatusChart data={financials.payment_status_breakdown} />
            : <p style={{ color: GRAY }}>No transactions yet.</p>
          }

          <SectionTitle sub="Members ranked by total amount paid, all-time">
            Top Paying Members
          </SectionTitle>
          <TopPayingMembersTable members={financials.top_paying_members} />

          <SectionTitle sub="One-time guest ticket revenue per event">
            Revenue by Event
          </SectionTitle>
          <RevenueByEventTable rows={financials.revenue_by_event} />

          <SectionTitle sub="Last 30 payment attempts, membership and guest tickets combined">
            Recent Transactions
          </SectionTitle>
          <div className="admin-table-wrap">
            <TransactionsTable rows={financials.recent_transactions} emptyMsg="No transactions yet." />
          </div>

          <SectionTitle sub="Declined, errored, or voided payments — worth a follow-up">
            Failed Payments
          </SectionTitle>
          <div className="admin-table-wrap">
            <TransactionsTable rows={financials.failed_transactions} emptyMsg="No failed payments — clean record!" />
          </div>
        </div>
      )}

      {/* ── MEMBERS ── */}
      {section === 'members' && (
        <div>
          <h2 className="dash-section-title">Membership Status</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <StatusPie active={overview.active_members} inactive={overview.inactive_members} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
              <KpiCard label="Activation Rate" value={pct(overview.activation_rate)} color={GREEN} />
              <KpiCard label="New This Month" value={overview.new_this_month} color={BLUE}
                sub={overview.mom_growth != null ? `${overview.mom_growth > 0 ? '+' : ''}${overview.mom_growth}% vs last month` : null} />
            </div>
          </div>

          <SectionTitle sub="Activation rate for members who joined each month">
            Cohort Activation Analysis
          </SectionTitle>
          <CohortTable cohorts={cohorts} />

          <SectionTitle sub="Members who joined 14+ days ago and have zero RSVPs">
            Never Engaged ({disengaged.length})
          </SectionTitle>
          <DisengagedTable
            members={disengaged.slice(0, 20)}
            emptyMsg="Everyone who joined 14+ days ago has RSVPd at least once — great!"
          />
        </div>
      )}

      {/* ── EVENTS ── */}
      {section === 'events' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 8 }}>
            <KpiCard label="Total Events" value={overview.total_events} />
            <KpiCard label="Upcoming" value={overview.upcoming_events} color={BLUE} />
            <KpiCard label="Past" value={overview.past_events} color={GRAY} />
            <KpiCard label="Total RSVPs" value={overview.total_rsvps} color={ROSE} />
            <KpiCard label="Avg Fill Rate" value={pct(overview.avg_fill_rate)}
              color={overview.avg_fill_rate >= 70 ? GREEN : overview.avg_fill_rate >= 40 ? AMBER : ROSE} />
          </div>

          <SectionTitle sub="Percentage of seats filled per event (green ≥80%, amber ≥50%, red <50%)">
            Fill Rate by Event
          </SectionTitle>
          {events.length ? <EventsChart events={events} /> : <p style={{ color: GRAY }}>No events yet.</p>}

          <SectionTitle sub="All events with RSVP counts">
            Event Details
          </SectionTitle>
          <div className="admin-table-wrap">
            <EventsTable events={events} />
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      {section === 'content' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 8 }}>
            <KpiCard label="Content Items" value={overview.total_content} />
            <KpiCard label="Total Unlocks" value={overview.total_unlocks} color={ROSE} />
            <KpiCard label="Avg Unlocks / Item" value={
              overview.total_content ? (overview.total_unlocks / overview.total_content).toFixed(1) : 0
            } color={AMBER} />
          </div>

          <SectionTitle sub="Times each piece of content has been unlocked by members">
            Content Unlocks Leaderboard
          </SectionTitle>
          {content_engagement.length
            ? <ContentChart data={content_engagement} />
            : <p style={{ color: GRAY }}>No content unlocked yet.</p>
          }

          <SectionTitle>All Content Items</SectionTitle>
          <div className="admin-table-wrap">
            <table className="admin-table" style={{ fontSize: 13 }}>
              <thead>
                <tr><th>#</th><th>Title</th><th>Type</th><th>Unlocks</th><th>Published</th></tr>
              </thead>
              <tbody>
                {content_engagement.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color: GRAY }}>{i + 1}</td>
                    <td><strong>{c.title}</strong></td>
                    <td>
                      <span style={{ fontSize: 11, background: '#f0e0e5', color: ROSE, borderRadius: 10, padding: '2px 8px' }}>
                        {c.type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: c.unlock_count > 0 ? ROSE : GRAY }}>
                        {c.unlock_count}
                      </span>
                    </td>
                    <td className="admin-td-muted">
                      {c.published_at ? new Date(c.published_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ENGAGEMENT ── */}
      {section === 'engagement' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 8 }}>
            <KpiCard label="Engagement Rate" value={pct(overview.engagement_rate)} color={AMBER}
              sub="Members who RSVPd ≥1 event" />
            <KpiCard label="Never Engaged" value={disengaged.length} color={ROSE}
              sub="Joined 14d+ ago, 0 RSVPs" />
            <KpiCard label="At Risk (Active)" value={at_risk.length} color={AMBER}
              sub="Active, no RSVP in 60d" />
          </div>

          <SectionTitle sub="Top 10 members by engagement score (RSVPs × 3 + unlocks × 2)">
            Most Engaged Members
          </SectionTitle>
          {top_members.length
            ? <TopMembersTable members={top_members} />
            : <p style={{ color: GRAY }}>No activity yet.</p>
          }

          <SectionTitle sub="Active members who haven't RSVPd in 60+ days — consider reaching out">
            At-Risk Members ({at_risk.length})
          </SectionTitle>
          <AtRiskTable members={at_risk} />

          <SectionTitle sub="Joined 14+ days ago with zero RSVPs — consider an outreach campaign">
            Never Engaged ({disengaged.length})
          </SectionTitle>
          <DisengagedTable
            members={disengaged.slice(0, 30)}
            emptyMsg="No disengaged members. Keep it up!"
          />
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {section === 'activity' && (
        <div>
          <h2 className="dash-section-title">Recent Activity</h2>
          <p style={{ color: GRAY, fontSize: 13, marginBottom: 20 }}>
            Last 20 actions across RSVPs, new joins, and content unlocks.
          </p>
          {recent_activity.length
            ? <ActivityFeed items={recent_activity} />
            : <p style={{ color: GRAY }}>No activity yet.</p>
          }
        </div>
      )}
    </div>
  )
}
