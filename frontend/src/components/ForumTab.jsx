import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Pin, MessageCircle, X, Image as ImageIcon, Smile,
  Loader2, SmilePlus, Send, ChevronDown,
} from 'lucide-react'
import {
  getTopics, createTopic, getTopic, createPost, react,
  uploadForumImage, searchGifs, trendingGifs,
} from '../api/forum'
import { cldOptimize } from '../utils/cloudinary'

const EMOJIS = ['❤️', '👍', '😂', '🎉', '🔥', '😮', '😢', '🙏', '👏', '💯']

const CATEGORIES = ['general', 'events', 'resources', 'introductions', 'off-topic']

const CAT_LABEL = {
  en: { all: 'All', general: 'General', events: 'Events', resources: 'Resources', introductions: 'Introductions', 'off-topic': 'Off-topic' },
  hy: { all: 'Բոլորը', general: 'Ընդհանուր', events: 'Միջոցառումներ', resources: 'Ռեսուրսներ', introductions: 'Ծանոթություն', 'off-topic': 'Այլ' },
}

const SORTS = [
  { key: 'latest',       en: 'Latest',        hy: 'Նորագույն' },
  { key: 'most_liked',   en: 'Most reactions', hy: 'Ամենաշատ ռեակցիա' },
  { key: 'most_replies', en: 'Most replies',  hy: 'Ամենաշատ պատասխան' },
  { key: 'oldest',       en: 'Oldest',        hy: 'Հնագույն' },
]

const T = (lang) => ({
  forum:       lang === 'hy' ? 'Ֆորում' : 'Forum',
  newTopic:    lang === 'hy' ? 'Նոր թեմա' : 'New topic',
  subscribePost: lang === 'hy' ? 'Բաժանորդագրվեք՝ գրելու համար' : 'Subscribe to post',
  search:      lang === 'hy' ? 'Որոնել թեմաներ...' : 'Search topics…',
  title:       lang === 'hy' ? 'Վերնագիր' : 'Title',
  body:        lang === 'hy' ? 'Կիսվեք ձեր մտքերով...' : 'Share your thoughts…',
  post:        lang === 'hy' ? 'Հրապարակել' : 'Post',
  cancel:      lang === 'hy' ? 'Չեղարկել' : 'Cancel',
  reply:       lang === 'hy' ? 'Պատասխանել' : 'Reply',
  replyPh:     lang === 'hy' ? 'Գրեք պատասխան...' : 'Write a reply…',
  noTopics:    lang === 'hy' ? 'Դեռ թեմաներ չկան — սկսեք զրույցը։' : 'No topics yet — start a conversation!',
  replies:     lang === 'hy' ? 'պատասխան' : 'replies',
  by:          lang === 'hy' ? '' : 'by ',
  photo:       lang === 'hy' ? 'Նկար' : 'Photo',
  gif:         'GIF',
  gifSearch:   lang === 'hy' ? 'Որոնել GIF...' : 'Search GIFs…',
  subReply:    lang === 'hy' ? 'Բաժանորդագրվեք՝ պատասխանելու համար' : 'Subscribe to reply',
  subscribe:   lang === 'hy' ? 'Բաժանորդագրվել' : 'Subscribe',
  uploading:   lang === 'hy' ? 'Բեռնում...' : 'Uploading…',
})

const fmtDate = (d, lang) => new Date(d).toLocaleDateString(lang === 'hy' ? 'hy-AM' : 'en-US', { month: 'short', day: 'numeric' })

function Avatar({ user, size = 36 }) {
  if (user?.photo_url)
    return <img src={cldOptimize(user.photo_url, { width: 96 })} alt={user.full_name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#f5c0c0', color: '#c0394b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.42, flexShrink: 0 }}>
      {user?.full_name?.charAt(0) || '?'}
    </div>
  )
}

/* ── Reaction bar: existing chips + add-reaction popover ───────────────────── */
function ReactionBar({ targetType, targetId, reactions = [], isActive, onSubscribe, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = async (emoji) => {
    if (!isActive) { onSubscribe?.(); return }
    if (busy) return
    setBusy(true)
    setOpen(false)
    try {
      const updated = await react(targetType, targetId, emoji)
      onUpdate?.(updated)
    } catch { /* ignore */ }
    finally { setBusy(false) }
  }

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', position: 'relative' }} onClick={e => e.stopPropagation()}>
      {reactions.map(r => (
        <button key={r.emoji} onClick={() => toggle(r.emoji)} disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
            background: r.reacted ? 'var(--rose-bg, #fdecec)' : '#f4f2f0',
            border: `1px solid ${r.reacted ? 'var(--rose)' : 'transparent'}`,
            color: r.reacted ? 'var(--rose)' : '#555', fontWeight: 600, lineHeight: 1.6,
          }}>
          <span style={{ fontSize: 14 }}>{r.emoji}</span>{r.count}
        </button>
      ))}
      <button onClick={() => (isActive ? setOpen(o => !o) : onSubscribe?.())} disabled={busy}
        title="React"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 26, borderRadius: 20, border: '1px solid var(--sand)', background: '#fff', color: '#999', cursor: 'pointer' }}>
        <SmilePlus size={15} />
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: '110%', left: 0, zIndex: 30, background: '#fff', border: '1px solid var(--sand)', borderRadius: 14, padding: '8px 10px', boxShadow: '0 8px 28px rgba(44,26,26,.16)', display: 'flex', gap: 4, flexWrap: 'wrap', width: 210 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => toggle(e)}
              style={{ fontSize: 20, width: 34, height: 34, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={ev => ev.currentTarget.style.background = '#f4f2f0'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── GIF picker overlay (Giphy via backend proxy) ─────────────────────────── */
function GifPicker({ lang, onPick, onClose }) {
  const t = T(lang)
  const [q, setQ] = useState('')
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setErr('')
    const run = q.trim() ? searchGifs(q.trim()) : trendingGifs()
    run.then(g => { if (alive) { setGifs(g || []); setLoading(false) } })
       .catch(() => { if (alive) { setErr(lang === 'hy' ? 'GIF-երը հասանելի չեն' : 'GIFs unavailable'); setLoading(false) } })
    return () => { alive = false }
  }, [q, lang])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(44,26,26,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sand)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={17} color="#aaa" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t.gifSearch}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 12, overflowY: 'auto', columnCount: 2, columnGap: 8 }}>
          {loading && <div style={{ columnSpan: 'all', textAlign: 'center', padding: 40, color: '#aaa' }}><Loader2 size={22} className="spin" /></div>}
          {err && <p style={{ columnSpan: 'all', textAlign: 'center', padding: 40, color: '#c0394b', fontSize: 13 }}>{err}</p>}
          {!loading && !err && gifs.map(g => (
            <img key={g.id} src={g.preview_url} alt={g.title} loading="lazy"
              onClick={() => onPick(g.url)}
              style={{ width: '100%', marginBottom: 8, borderRadius: 8, cursor: 'pointer', display: 'block' }} />
          ))}
          {!loading && !err && !gifs.length && <p style={{ columnSpan: 'all', textAlign: 'center', padding: 40, color: '#aaa', fontSize: 13 }}>—</p>}
        </div>
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--sand)', textAlign: 'right', fontSize: 10, color: '#c4b8b2' }}>Powered by GIPHY</div>
      </div>
    </div>
  )
}

/* ── Attachment bar (shared by topic composer + reply box) ────────────────── */
function AttachBar({ lang, imageUrl, onImage, onClear, onOpenGif, uploading }) {
  const t = T(lang)
  const fileRef = useRef(null)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    onImage(file)
  }

  return (
    <div>
      {imageUrl && (
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
          <img src={cldOptimize(imageUrl, { width: 500 })} alt="" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 10, display: 'block' }} />
          <button type="button" onClick={onClear}
            style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          style={btnGhost}>
          {uploading ? <Loader2 size={15} className="spin" /> : <ImageIcon size={15} />} {uploading ? t.uploading : t.photo}
        </button>
        <button type="button" onClick={onOpenGif} style={btnGhost}>
          <Smile size={15} /> {t.gif}
        </button>
      </div>
    </div>
  )
}

const btnGhost = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
  border: '1px solid var(--sand)', background: '#fff', color: '#7a6a63', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

/* ── Main forum tab ───────────────────────────────────────────────────────── */
export default function ForumTab({ lang = 'en', isActive, onSubscribe, checkoutLoading, initialTopicId, onConsumedInitialTopic }) {
  const t = T(lang)
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('latest')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  const [showComposer, setShowComposer] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', category: 'general', image_url: null })
  const [posting, setPosting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [gifFor, setGifFor] = useState(null) // 'topic' | 'reply' | null

  const [openTopic, setOpenTopic] = useState(null)
  const [reply, setReply] = useState({ body: '', image_url: null })
  const [replyUploading, setReplyUploading] = useState(false)
  const [postingReply, setPostingReply] = useState(false)

  // debounce search
  useEffect(() => { const id = setTimeout(() => setDebounced(query), 350); return () => clearTimeout(id) }, [query])

  const load = useCallback(() => {
    setLoading(true)
    getTopics({ category, sort, q: debounced })
      .then(d => { setTopics(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [category, sort, debounced])

  useEffect(() => { load() }, [load])

  // apply a reaction summary returned from the API to a target in state
  const applyTopicReactions = (topicId, reactions) =>
    setTopics(ts => ts.map(t => t.id === topicId ? { ...t, reactions, reaction_count: reactions.reduce((s, r) => s + r.count, 0) } : t))

  const uploadImage = async (file, setBusy, apply) => {
    setBusy(true)
    try { const { url } = await uploadForumImage(file); apply(url) }
    catch { /* ignore */ }
    finally { setBusy(false) }
  }

  const submitTopic = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || (!form.body.trim() && !form.image_url)) return
    setPosting(true)
    try {
      const topic = await createTopic(form)
      setForm({ title: '', body: '', category: 'general', image_url: null })
      setShowComposer(false)
      // refresh to respect current sort/filter
      load()
      if (topic) setTopics(ts => ts.some(x => x.id === topic.id) ? ts : [topic, ...ts])
    } catch { /* ignore */ }
    finally { setPosting(false) }
  }

  const openDetail = async (topic) => {
    const detail = await getTopic(topic.id).catch(() => null)
    if (detail) setOpenTopic(detail)
  }

  // deep-link from a member's profile ("recent forum activity") straight into a topic
  useEffect(() => {
    if (!initialTopicId) return
    openDetail({ id: initialTopicId })
    onConsumedInitialTopic?.()
  }, [initialTopicId])

  const submitReply = async () => {
    if (!openTopic || (!reply.body.trim() && !reply.image_url)) return
    setPostingReply(true)
    try {
      const post = await createPost(openTopic.id, reply)
      setOpenTopic(tp => ({ ...tp, posts: [...(tp.posts || []), post], post_count: (tp.post_count || 0) + 1 }))
      setReply({ body: '', image_url: null })
      setTopics(ts => ts.map(x => x.id === openTopic.id ? { ...x, post_count: (x.post_count || 0) + 1 } : x))
    } catch { /* ignore */ }
    finally { setPostingReply(false) }
  }

  return (
    <div className="dash-section">
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <h2 className="dash-section-title" style={{ marginBottom: 0 }}>{t.forum}</h2>
        <button onClick={() => isActive ? setShowComposer(v => !v) : onSubscribe?.()} disabled={!isActive && checkoutLoading}
          style={{ background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {isActive ? `+ ${t.newTopic}` : t.subscribePost}
        </button>
      </div>

      {/* toolbar: search + sort */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--sand)', borderRadius: 10, padding: '8px 12px' }}>
          <Search size={16} color="#bbb" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }} />
          {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc' }}><X size={15} /></button>}
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--sand)', borderRadius: 10, padding: '0 10px' }}>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ appearance: 'none', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: '#7a6a63', padding: '9px 22px 9px 4px', cursor: 'pointer' }}>
            {SORTS.map(s => <option key={s.key} value={s.key}>{lang === 'hy' ? s.hy : s.en}</option>)}
          </select>
          <ChevronDown size={15} color="#bbb" style={{ position: 'absolute', right: 8, pointerEvents: 'none' }} />
        </div>
      </div>

      {/* category chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {['all', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: category === cat ? 'var(--rose)' : 'transparent',
              color: category === cat ? '#fff' : 'var(--stone, #7a6a63)',
              borderColor: category === cat ? 'var(--rose)' : 'var(--sand)',
            }}>
            {CAT_LABEL[lang]?.[cat] || cat}
          </button>
        ))}
      </div>

      {/* composer */}
      {showComposer && isActive && (
        <form onSubmit={submitTopic} style={{ background: '#fff', border: '1px solid var(--sand)', borderRadius: 16, padding: 20, marginBottom: 18, boxShadow: '0 2px 14px rgba(44,26,26,.05)' }}>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--sand)', marginBottom: 10, fontSize: 13, fontWeight: 600, color: '#7a6a63' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[lang]?.[c] || c}</option>)}
          </select>
          <input placeholder={t.title} required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid var(--sand)', marginBottom: 10, fontSize: 15, fontWeight: 600, boxSizing: 'border-box' }} />
          <textarea placeholder={t.body} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid var(--sand)', minHeight: 90, fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
          <div style={{ marginBottom: 14 }}>
            <AttachBar lang={lang} imageUrl={form.image_url} uploading={uploading}
              onImage={file => uploadImage(file, setUploading, url => setForm(f => ({ ...f, image_url: url })))}
              onClear={() => setForm(f => ({ ...f, image_url: null }))}
              onOpenGif={() => setGifFor('topic')} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setShowComposer(false)}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--sand)', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {t.cancel}
            </button>
            <button type="submit" disabled={posting}
              style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: 'var(--rose)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              {posting ? '…' : t.post}
            </button>
          </div>
        </form>
      )}

      {/* topic list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#c9bdb7' }}><Loader2 size={26} className="spin" /></div>
      ) : topics.length === 0 ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: 44 }}>{t.noTopics}</p>
      ) : (
        topics.map(topic => (
          <article key={topic.id} onClick={() => openDetail(topic)}
            style={{ background: '#fff', border: '1px solid var(--sand)', borderRadius: 16, padding: '16px 20px', marginBottom: 12, cursor: 'pointer', transition: 'box-shadow .15s, transform .15s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(168,92,90,.13)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <Avatar user={topic.author} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                  {topic.pinned && <span style={{ fontSize: 10.5, background: 'var(--rose-bg, #fdecec)', color: 'var(--rose)', borderRadius: 6, padding: '2px 8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Pin size={10} /> Pinned</span>}
                  <span style={{ fontSize: 10.5, background: '#f4f2f0', color: '#8a7a72', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{CAT_LABEL[lang]?.[topic.category] || topic.category}</span>
                  <span style={{ fontSize: 12, color: '#b3a9a3' }}>{t.by}{topic.author?.full_name} · {fmtDate(topic.created_at, lang)}</span>
                </div>
                <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--deep, #2c1a1a)', margin: '0 0 4px' }}>{topic.title}</p>
                <p style={{ fontSize: 13.5, color: '#6b5d56', margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{topic.body}</p>
                {topic.image_url && (
                  <img src={cldOptimize(topic.image_url, { width: 700 })} alt="" style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 10, marginBottom: 10, display: 'block' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <ReactionBar targetType="topic" targetId={topic.id} reactions={topic.reactions} isActive={isActive} onSubscribe={onSubscribe}
                    onUpdate={(r) => applyTopicReactions(topic.id, r)} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#a89e98', fontWeight: 600 }}>
                    <MessageCircle size={14} /> {topic.post_count} {t.replies}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))
      )}

      {/* topic detail modal */}
      {openTopic && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(44,26,26,.6)', overflowY: 'auto', padding: 20 }}
          onClick={() => setOpenTopic(null)}>
          <div style={{ background: '#fff', borderRadius: 20, maxWidth: 640, margin: '40px auto', padding: '28px', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpenTopic(null)} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#bbb' }}><X size={22} /></button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {openTopic.pinned && <span style={{ fontSize: 10.5, background: 'var(--rose-bg, #fdecec)', color: 'var(--rose)', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>Pinned</span>}
              <span style={{ fontSize: 11, background: '#f4f2f0', color: '#8a7a72', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{CAT_LABEL[lang]?.[openTopic.category] || openTopic.category}</span>
            </div>
            <h2 style={{ fontFamily: '"Cormorant Garamond","Noto Sans Armenian",serif', fontSize: 25, color: 'var(--deep,#2c1a1a)', margin: '0 0 12px' }}>{openTopic.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Avatar user={openTopic.author} size={34} />
              <div style={{ fontSize: 13, color: '#8a7a72' }}>{openTopic.author?.full_name} · {fmtDate(openTopic.created_at, lang)}</div>
            </div>
            <p style={{ fontSize: 15, color: '#493f3a', lineHeight: 1.7, margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>{openTopic.body}</p>
            {openTopic.image_url && <img src={cldOptimize(openTopic.image_url, { width: 900 })} alt="" style={{ maxWidth: '100%', borderRadius: 12, marginBottom: 16, display: 'block' }} />}
            <div style={{ paddingBottom: 18, borderBottom: '1px solid var(--sand)', marginBottom: 20 }}>
              <ReactionBar targetType="topic" targetId={openTopic.id} reactions={openTopic.reactions} isActive={isActive} onSubscribe={onSubscribe}
                onUpdate={(r) => { setOpenTopic(tp => ({ ...tp, reactions: r })); applyTopicReactions(openTopic.id, r) }} />
            </div>

            {/* posts */}
            {(openTopic.posts || []).map(post => (
              <div key={post.id} style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                <Avatar user={post.author} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: '#a89e98', marginBottom: 4 }}>
                    <strong style={{ color: '#6b5d56' }}>{post.author?.full_name}</strong> · {fmtDate(post.created_at, lang)}
                  </div>
                  {post.body && <p style={{ fontSize: 14.5, color: '#493f3a', lineHeight: 1.6, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{post.body}</p>}
                  {post.image_url && <img src={cldOptimize(post.image_url, { width: 700 })} alt="" style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 10, marginBottom: 8, display: 'block' }} />}
                  <ReactionBar targetType="post" targetId={post.id} reactions={post.reactions} isActive={isActive} onSubscribe={onSubscribe}
                    onUpdate={(r) => setOpenTopic(tp => ({ ...tp, posts: tp.posts.map(p => p.id === post.id ? { ...p, reactions: r } : p) }))} />
                </div>
              </div>
            ))}

            {/* reply box */}
            <div style={{ marginTop: 22 }}>
              {isActive ? (
                <div style={{ background: '#faf8f7', border: '1px solid var(--sand)', borderRadius: 14, padding: 14 }}>
                  <textarea value={reply.body} onChange={e => setReply(r => ({ ...r, body: e.target.value }))} placeholder={t.replyPh}
                    style={{ width: '100%', minHeight: 70, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--sand)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }} />
                  <div style={{ marginBottom: 10 }}>
                    <AttachBar lang={lang} imageUrl={reply.image_url} uploading={replyUploading}
                      onImage={file => uploadImage(file, setReplyUploading, url => setReply(r => ({ ...r, image_url: url })))}
                      onClear={() => setReply(r => ({ ...r, image_url: null }))}
                      onOpenGif={() => setGifFor('reply')} />
                  </div>
                  <button onClick={submitReply} disabled={postingReply || (!reply.body.trim() && !reply.image_url)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (postingReply || (!reply.body.trim() && !reply.image_url)) ? 0.6 : 1 }}>
                    <Send size={15} /> {postingReply ? '…' : t.reply}
                  </button>
                </div>
              ) : (
                <div style={{ background: '#fff8f5', border: '1px solid #f5ddd0', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: '#8a746a' }}>{t.subReply}</span>
                  <button onClick={onSubscribe} disabled={checkoutLoading}
                    style={{ background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {checkoutLoading ? '…' : t.subscribe}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* gif picker */}
      {gifFor && (
        <GifPicker lang={lang}
          onClose={() => setGifFor(null)}
          onPick={(url) => {
            if (gifFor === 'topic') setForm(f => ({ ...f, image_url: url }))
            else setReply(r => ({ ...r, image_url: url }))
            setGifFor(null)
          }} />
      )}
    </div>
  )
}
