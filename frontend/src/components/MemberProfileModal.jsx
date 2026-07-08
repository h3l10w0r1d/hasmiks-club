import { useState, useEffect } from 'react'
import { X, Phone, Send, MessageCircle, ExternalLink, CalendarCheck, BookOpen, MessageSquare, Loader2 } from 'lucide-react'
import { getMemberProfile } from '../api/members'
import { cldOptimize } from '../utils/cloudinary'

const T = (lang) => ({
  memberSince: lang === 'hy' ? 'Անդամ' : 'Member since',
  events:      lang === 'hy' ? 'Մասնակցել է' : 'Events attended',
  library:     lang === 'hy' ? 'Կարդացել է' : 'From the library',
  forum:       lang === 'hy' ? 'Վերջին ակտիվությունը ֆորումում' : 'Recent forum activity',
  noActivity:  lang === 'hy' ? 'Դեռ ակտիվություն չկա' : 'No activity yet',
  loadError:   lang === 'hy' ? 'Չհաջողվեց բեռնել պրոֆիլը' : 'Could not load this profile',
  photos:      lang === 'hy' ? 'Լուսանկարներ' : 'Photos',
  recipe:      lang === 'hy' ? 'Բաղադրատոմս' : 'Recipe',
  ebook:       lang === 'hy' ? 'Էլ. գիրք' : 'E-Book',
})

function telegramLink(u) { const h = u.replace(/^@/, ''); return `https://t.me/${h}` }
function whatsappLink(n) { return `https://wa.me/${n.replace(/[^\d]/g, '')}` }
function fmtDate(d, lang) { return new Date(d).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

function Section({ icon, title, children, empty }) {
  return (
    <div style={{ marginTop: 22, textAlign: 'left' }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--deep, #2c1a1a)', marginBottom: 10 }}>
        {icon} {title}
      </p>
      {empty ? <p style={{ fontSize: 12.5, color: '#bbb', fontStyle: 'italic' }}>{empty}</p> : children}
    </div>
  )
}

export default function MemberProfileModal({ member, lang = 'en', onClose, onOpenForumTopic }) {
  const t = T(lang)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getMemberProfile(member.id)
      .then(p => { if (alive) setProfile(p) })
      .catch(() => { if (alive) setError(t.loadError) })
    return () => { alive = false }
  }, [member.id])

  const contactLinks = profile && [
    profile.facebook_url && { key: 'fb', icon: <ExternalLink size={15} />, label: 'Facebook', href: profile.facebook_url },
    profile.telegram_username && { key: 'tg', icon: <Send size={15} />, label: profile.telegram_username.replace(/^@/, '@'), href: telegramLink(profile.telegram_username) },
    profile.phone && { key: 'ph', icon: <Phone size={15} />, label: profile.phone, href: `tel:${profile.phone}` },
    profile.whatsapp && { key: 'wa', icon: <MessageCircle size={15} />, label: 'WhatsApp', href: whatsappLink(profile.whatsapp) },
  ].filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(44,26,26,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, maxWidth: 460, width: '100%', margin: '40px auto', padding: '32px 28px', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,.25)', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#bbb' }}><X size={22} /></button>

        {member.photo_url
          ? <img src={cldOptimize(member.photo_url, { width: 180 })} alt={member.full_name} style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '4px solid #f5c0c0', marginBottom: 16 }} />
          : <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#f5c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px', color: '#c0394b', fontWeight: 700 }}>
              {member.full_name.charAt(0)}
            </div>
        }
        <h2 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian",serif', fontSize: 24, fontWeight: 700, color: '#2c1a1a', margin: '0 0 6px' }}>{member.full_name}</h2>
        <p style={{ fontSize: 12, color: '#aaa' }}>{t.memberSince} {new Date(member.joined_at).getFullYear()}</p>

        {!profile && !error && (
          <div style={{ padding: 30, color: '#c9bdb7' }}><Loader2 size={22} className="spin" /></div>
        )}
        {error && <p style={{ fontSize: 13, color: '#c0394b', marginTop: 16 }}>{error}</p>}

        {profile && (
          <>
            {profile.bio && (
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, borderTop: '1px solid #f0e0e5', paddingTop: 16, marginTop: 16, textAlign: 'left' }}>{profile.bio}</p>
            )}

            {contactLinks.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                {contactLinks.map(c => (
                  <a key={c.key} href={c.href} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: '#f4f2f0', color: 'var(--deep,#2c1a1a)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>
                    {c.icon} {c.label}
                  </a>
                ))}
              </div>
            )}

            {profile.profile_photos.length > 0 && (
              <Section icon={null} title={t.photos}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {profile.profile_photos.map(p => (
                    <img key={p.id} src={cldOptimize(p.url, { width: 300 })} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              </Section>
            )}

            <Section icon={<CalendarCheck size={15} />} title={t.events} empty={!profile.attended_events.length ? t.noActivity : null}>
              {profile.attended_events.map(e => (
                <div key={e.id} style={{ fontSize: 13, color: '#555', padding: '5px 0', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span>{e.title}</span><span style={{ color: '#aaa', flexShrink: 0 }}>{fmtDate(e.event_date, lang)}</span>
                </div>
              ))}
            </Section>

            <Section icon={<BookOpen size={15} />} title={t.library} empty={!profile.library_items.length ? t.noActivity : null}>
              {profile.library_items.map(l => (
                <div key={l.id} style={{ fontSize: 13, color: '#555', padding: '5px 0', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span>{l.title}</span><span style={{ color: '#aaa', flexShrink: 0, fontSize: 11.5 }}>{l.type === 'ebook' ? t.ebook : t.recipe}</span>
                </div>
              ))}
            </Section>

            <Section icon={<MessageSquare size={15} />} title={t.forum} empty={!profile.forum_activity.length ? t.noActivity : null}>
              {profile.forum_activity.map((a, i) => (
                <button key={i} onClick={() => onOpenForumTopic?.(a.topic_id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: '#faf8f7', border: 'none', borderRadius: 10, padding: '10px 12px', marginBottom: 6, cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--deep,#2c1a1a)' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.snippet}</div>
                </button>
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
