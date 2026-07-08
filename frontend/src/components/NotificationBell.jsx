import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getNotifications, markRead, markAllRead } from '../api/notifications'

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const TYPE_COLOR = { rsvp: '#3498db', waitlist: '#f39c12', content: '#c0394b', system: '#2ecc71' }

export default function NotificationBell() {
  const [data, setData] = useState({ unread_count: 0, notifications: [] })
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const load = () => getNotifications().then(setData).catch(() => {})

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  // close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleClick = async (n) => {
    if (!n.is_read) {
      await markRead(n.id)
      setData(d => ({
        ...d,
        unread_count: Math.max(0, d.unread_count - 1),
        notifications: d.notifications.map(x => x.id === n.id ? { ...x, is_read: true } : x),
      }))
    }
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }

  const handleMarkAll = async () => {
    await markAllRead()
    setData(d => ({ ...d, unread_count: 0, notifications: d.notifications.map(x => ({ ...x, is_read: true })) }))
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', width: 44, height: 44, color: 'var(--deep, #221c16)',
        }}
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={1.75} />
        {data.unread_count > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: '#c0394b', color: '#fff', borderRadius: '50%',
            width: 18, height: 18, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {data.unread_count > 9 ? '9+' : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', width: 340,
          background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.14)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f0e0e5' }}>
            <span style={{ fontWeight: 700, color: '#2c1a1a' }}>Notifications</span>
            {data.unread_count > 0 && (
              <button onClick={handleMarkAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0394b', fontSize: 12, fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {data.notifications.length === 0
              ? <p style={{ padding: '24px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No notifications yet</p>
              : data.notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '12px 16px', cursor: n.link ? 'pointer' : 'default',
                    background: n.is_read ? '#fff' : '#fdf5f5',
                    borderBottom: '1px solid #f5ecee',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    transition: 'background .1s',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    background: n.is_read ? 'transparent' : TYPE_COLOR[n.type] || '#c0394b',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#2c1a1a', lineHeight: 1.4 }}>{n.text}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
