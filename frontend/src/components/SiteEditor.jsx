import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Save, Rocket, ExternalLink, Undo2, Redo2, Plus, ChevronDown, Monitor, Smartphone, Search, X, History,
  FilePlus, Trash2, Eye, EyeOff,
} from 'lucide-react'
import defaultContent from '../data/content'
import {
  AVAILABLE_SECTIONS, DEFAULT_LAYOUT, SECTION_LABEL, normalizeLayout,
  BLOCK_TEMPLATES, BLOCK_SEED, isCustomBlockId, newCustomBlockId,
} from '../data/landingSections'
import { PAGES_KEY, newPageId, slugify, uniqueSlug, normalizePageLayout } from '../data/sitePages'
import {
  adminGetSiteContent, adminSaveSiteContent, adminPublishSiteContent,
  adminGetSiteContentHistory, adminRestoreSiteContentHistory,
} from '../api/admin'
import {
  PREVIEW_MSG, PREVIEW_READY_MSG, EDIT_ACTION_MSG, EDIT_TEXT_MSG, EDIT_IMAGE_MSG, EDIT_FOCUS_MSG, EDIT_LIST_OP_MSG,
} from '../context/SiteContentContext'
import { moveInOrder, toggleHidden } from '../utils/cardOrder'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Field } from './ui/AdminShared'

// Which content namespace holds each page's SEO meta fields (metaTitle/metaDesc).
const SEO_NAMESPACE = { landing: 'landingMeta', about: 'about', contact: 'contact', events: 'events', terms: 'terms' }

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
const valueEqual = (a, b) =>
  (Array.isArray(a) || Array.isArray(b)) ? JSON.stringify(a ?? []) === JSON.stringify(b ?? []) : (a ?? '') === (b ?? '')

// Pages the editor's canvas can point at. Landing is the only one with a
// section layout (Add Block/reorder/hide); the others are single fixed pages
// whose text is still fully inline-editable on the canvas.
const PAGES = [
  { key: 'landing', label: 'Landing', path: '/preview' },
  { key: 'about', label: 'About', path: '/about' },
  { key: 'contact', label: 'Contact', path: '/contact' },
  { key: 'events', label: 'Events', path: '/events' },
  { key: 'terms', label: 'Terms', path: '/terms' },
]

// Centered dialog (backdrop + card) — used instead of an anchored dropdown
// for panels with real form content (SEO, History), since an absolutely
// positioned dropdown can get squeezed to nothing by the toolbar's flex-wrap
// at narrow widths.
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border bg-popover shadow-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function moveSection(layout, id, dir) {
  const arr = layout.map((s) => ({ ...s }))
  const idx = arr.findIndex((s) => s.id === id)
  if (idx < 0) return arr
  const step = dir === 'up' ? -1 : 1
  let j = idx + step
  while (j >= 0 && j < arr.length && !arr[j].enabled) j += step
  if (j < 0 || j >= arr.length) return arr
  ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
  return arr
}

// Landing has the single reserved "__layout" key; an admin-created page (id
// always starts with "page-", see newPageId()) has its own block layout at
// the nested reserved key "page.<id>.__layout". Fixed content pages
// (about/contact/events/terms) have neither — they're not block-based.
function getLayoutKey(page) {
  if (page === 'landing') return '__layout'
  if (page.startsWith('page-')) return `page.${page}.__layout`
  return null
}

export default function SiteEditor({ flash }) {
  const [overrides, setOverrides] = useState(null)
  const [saved, setSaved] = useState(null)
  const [history, setHistory] = useState({ past: [], future: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lang, setLang] = useState('hy')
  const [device, setDevice] = useState('desktop')
  const [page, setPage] = useState('landing')
  const [addOpen, setAddOpen] = useState(false)
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const [seoOpen, setSeoOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyList, setHistoryList] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const iframeRef = useRef(null)
  const previewReady = useRef(false)
  const overridesRef = useRef(null)
  overridesRef.current = overrides
  const fixedPage = PAGES.find((p) => p.key === page)
  const dynamicPages = Array.isArray(overrides?.[PAGES_KEY]) ? overrides[PAGES_KEY] : []
  const dynamicPageDef = !fixedPage ? dynamicPages.find((pg) => pg.id === page) : null
  const previewPath = fixedPage ? fixedPage.path : (dynamicPageDef ? `/p/${dynamicPageDef.slug}` : '/preview')
  const layoutKey = getLayoutKey(page)

  useEffect(() => {
    let alive = true
    adminGetSiteContent('draft')
      .then((data) => { if (alive) { const o = data && typeof data === 'object' ? data : {}; setOverrides(o); setSaved(o) } })
      .catch(() => flash?.('Failed to load site content', true))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const postToPreview = useCallback((o) => {
    const win = iframeRef.current?.contentWindow
    if (win && previewReady.current) win.postMessage({ type: PREVIEW_MSG, overrides: o }, window.location.origin)
  }, [])

  // ── value mutations ──
  const setField = useCallback((fp, value) => setOverrides((prev) => {
    const next = { ...prev }
    if (valueEqual(value, getPath(defaultContent, fp))) delete next[fp]
    else next[fp] = value
    return next
  }), [])
  const setListItem = useCallback((fp, index, value) => setOverrides((prev) => {
    const cur = fp in prev ? prev[fp] : getPath(defaultContent, fp)
    const arr = Array.isArray(cur) ? [...cur] : []
    arr[index] = value
    const next = { ...prev }
    if (valueEqual(arr, getPath(defaultContent, fp))) delete next[fp]
    else next[fp] = arr
    return next
  }), [])
  const setLayout = useCallback((key, newLayout) => setOverrides((prev) => ({ ...prev, [key]: newLayout })), [])
  // Unconditional override write (no default-value comparison) — used for the
  // card order/hidden arrays, which have no "default" in content.js to compare against.
  const setRaw = useCallback((path, value) => setOverrides((prev) => ({ ...prev, [path]: value })), [])

  // ── history ──
  const commit = useCallback(() => {
    const snap = JSON.stringify(overridesRef.current)
    setHistory((h) => (h.past.length && h.past[h.past.length - 1] === snap ? h : { past: [...h.past, snap], future: [] }))
  }, [])
  const undo = useCallback(() => setHistory((h) => {
    if (!h.past.length) return h
    const cur = JSON.stringify(overridesRef.current)
    setOverrides(JSON.parse(h.past[h.past.length - 1]))
    return { past: h.past.slice(0, -1), future: [cur, ...h.future] }
  }), [])
  const redo = useCallback(() => setHistory((h) => {
    if (!h.future.length) return h
    const cur = JSON.stringify(overridesRef.current)
    setOverrides(JSON.parse(h.future[0]))
    return { past: [...h.past, cur], future: h.future.slice(1) }
  }), [])

  // ── canvas messages ──
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      const d = event.data || {}
      if (d.type === PREVIEW_READY_MSG) { previewReady.current = true; postToPreview(overridesRef.current || {}) }
      else if (d.type === EDIT_FOCUS_MSG) commit()
      else if (d.type === EDIT_TEXT_MSG) {
        if (typeof d.listIndex === 'number') setListItem(d.path, d.listIndex, d.value)
        else setField(d.path, d.value)
      }
      else if (d.type === EDIT_IMAGE_MSG) setField(d.path, d.url)
      else if (d.type === EDIT_LIST_OP_MSG) {
        commit()
        for (const path of d.paths || []) {
          const cur = overridesRef.current?.[path] ?? getPath(defaultContent, path)
          const arr = Array.isArray(cur) ? [...cur] : []
          if (d.op === 'add') arr.push('')
          else if (d.op === 'remove' && typeof d.index === 'number') arr.splice(d.index, 1)
          setRaw(path, arr)
        }
      }
      else if (d.type === EDIT_ACTION_MSG) {
        commit()
        if (d.target === 'card') {
          const curOrder = overridesRef.current?.[d.orderPath]
          const curHidden = overridesRef.current?.[d.hiddenPath]
          if (d.action === 'hide') setRaw(d.hiddenPath, toggleHidden(curHidden, d.itemCount, d.index))
          else if (d.action === 'left' || d.action === 'right') setRaw(d.orderPath, moveInOrder(curOrder, curHidden, d.itemCount, d.index, d.action))
          return
        }
        if (d.action === 'style') { setField(`custom.${d.id}.${d.styleKey}`, d.value); return }
        const key = getLayoutKey(page)
        if (!key) return
        const currentLayout = key === '__layout'
          ? normalizeLayout(overridesRef.current?.__layout ?? DEFAULT_LAYOUT)
          : normalizePageLayout(overridesRef.current?.[key])
        if (d.action === 'delete') {
          setLayout(key, currentLayout.filter((s) => s.id !== d.id))
          setOverrides((prev) => {
            const next = { ...prev }
            const prefix = `custom.${d.id}.`
            for (const k of Object.keys(next)) if (k.startsWith(prefix)) delete next[k]
            return next
          })
          return
        }
        if (d.action === 'hide') setLayout(key, currentLayout.map((s) => (s.id === d.id ? { ...s, enabled: false } : s)))
        else if (d.action === 'up' || d.action === 'down') setLayout(key, moveSection(currentLayout, d.id, d.action))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [postToPreview, commit, setField, setListItem, setLayout, setRaw, page])

  // push draft into the live canvas on every change
  useEffect(() => { if (overrides) postToPreview(overrides) }, [overrides, postToPreview])
  // the canvas reloads when the previewed page changes; wait for its next READY
  useEffect(() => { previewReady.current = false }, [previewPath])

  if (loading || !overrides) return <div className="py-12 text-sm text-muted-foreground">Loading the site editor…</div>

  const layout = layoutKey
    ? (layoutKey === '__layout' ? normalizeLayout(overrides.__layout ?? DEFAULT_LAYOUT) : normalizePageLayout(overrides[layoutKey]))
    : []
  const hiddenSections = layout.filter((s) => !s.enabled)
  const dirty = JSON.stringify(overrides) !== JSON.stringify(saved)

  const addSection = (id) => { commit(); setLayout(layoutKey, layout.map((s) => (s.id === id ? { ...s, enabled: true } : s))); setAddOpen(false) }
  const addCustomBlock = (type) => {
    commit()
    const id = newCustomBlockId()
    setLayout(layoutKey, [...layout, { id, enabled: true, type }])
    // Seed real starting content (not just a cosmetic placeholder) so Add/Remove
    // on repeatable fields (paragraphs, stat pairs, FAQ rows) work correctly
    // from the very first click — see BLOCK_SEED for why.
    const seed = BLOCK_SEED[type] || {}
    setOverrides((prev) => {
      const next = { ...prev }
      for (const [key, value] of Object.entries(seed)) next[`custom.${id}.${key}`] = value
      return next
    })
    setAddOpen(false)
  }
  const switchLang = (l) => { setLang(l); try { localStorage.setItem('hasmik_lang', l) } catch { /* noop */ } previewReady.current = false; setReloadKey((k) => k + 1) }
  const switchPage = (key) => { setPage(key); setPageMenuOpen(false); setSeoOpen(false) }
  const currentPageLabel = fixedPage?.label
    ?? (dynamicPageDef ? ((lang === 'hy' ? dynamicPageDef.titleHy : dynamicPageDef.titleEn) || dynamicPageDef.slug) : 'Landing')

  const createPage = () => {
    const title = window.prompt('New page title (shown in the browser tab, and in the nav menu if enabled):')
    if (!title || !title.trim()) return
    commit()
    const id = newPageId()
    const slug = uniqueSlug(slugify(title), dynamicPages.map((pg) => pg.slug))
    const pageDef = { id, slug, titleEn: title.trim(), titleHy: title.trim(), navEn: title.trim(), navHy: title.trim(), showInNav: true }
    setOverrides((prev) => ({ ...prev, [PAGES_KEY]: [...dynamicPages, pageDef], [`page.${id}.__layout`]: [] }))
    setPage(id)
    setPageMenuOpen(false)
  }
  const togglePageNav = (pg) => {
    commit()
    setOverrides((prev) => ({
      ...prev,
      [PAGES_KEY]: (prev[PAGES_KEY] || []).map((p) => (p.id === pg.id ? { ...p, showInNav: !p.showInNav } : p)),
    }))
  }
  const deletePage = (pg) => {
    if (!window.confirm(`Delete "${pg.titleEn || pg.slug}"? This removes the page and its blocks from the draft (you can still Undo).`)) return
    commit()
    setOverrides((prev) => {
      const next = { ...prev }
      const pageLayout = normalizePageLayout(next[`page.${pg.id}.__layout`])
      for (const block of pageLayout) {
        const blockPrefix = `custom.${block.id}.`
        for (const k of Object.keys(next)) if (k.startsWith(blockPrefix)) delete next[k]
      }
      const pagePrefix = `page.${pg.id}.`
      for (const k of Object.keys(next)) if (k.startsWith(pagePrefix)) delete next[k]
      next[PAGES_KEY] = (next[PAGES_KEY] || []).filter((p) => p.id !== pg.id)
      return next
    })
    if (page === pg.id) setPage('landing')
    setPageMenuOpen(false)
  }

  // ── SEO meta fields for whichever page is currently previewed ──
  const sfx = lang === 'hy' ? 'Hy' : 'En'
  const seoNs = fixedPage ? SEO_NAMESPACE[page] : `page.${page}`
  const seoTitlePath = `${seoNs}.metaTitle${sfx}`
  const seoDescPath = `${seoNs}.metaDesc${sfx}`
  const seoTitle = seoTitlePath in overrides ? overrides[seoTitlePath] : getPath(defaultContent, seoTitlePath)
  const seoDesc = seoDescPath in overrides ? overrides[seoDescPath] : getPath(defaultContent, seoDescPath)

  const handleSave = async () => {
    setSaving(true)
    try { const s = await adminSaveSiteContent(overrides); setSaved(s); flash?.('Draft saved') }
    catch (e) { flash?.(e?.response?.data?.detail || 'Failed to save draft', true) }
    finally { setSaving(false) }
  }
  const handlePublish = async () => {
    setPublishing(true)
    try { await adminSaveSiteContent(overrides); setSaved(overrides); await adminPublishSiteContent(); flash?.('Published — the changes are now live') }
    catch (e) { flash?.(e?.response?.data?.detail || 'Failed to publish', true) }
    finally { setPublishing(false) }
  }
  const openHistory = async () => {
    setHistoryOpen((o) => !o)
    setSeoOpen(false)
    try { setHistoryList(await adminGetSiteContentHistory()) } catch { setHistoryList([]) }
  }
  const restoreHistory = async (index) => {
    setRestoring(true)
    commit()
    try {
      const content = await adminRestoreSiteContentHistory(index)
      setOverrides(content)
      setSaved(content)
      setHistoryOpen(false)
      flash?.('Restored into the draft — review it, then Save/Publish when ready')
    } catch (e) { flash?.(e?.response?.data?.detail || 'Failed to restore', true) }
    finally { setRestoring(false) }
  }

  return (
    <div className="space-y-3">
      {/* ── TOP TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="relative">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPageMenuOpen((o) => !o)}>
            {currentPageLabel} <ChevronDown size={13} />
          </Button>
          {pageMenuOpen && (
            <div className="absolute z-50 mt-1 w-64 rounded-md border bg-popover shadow-lg p-1">
              {PAGES.map((p) => (
                <button key={p.key} type="button" onClick={() => switchPage(p.key)}
                  className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted ${page === p.key ? 'bg-muted font-medium' : ''}`}>
                  {p.label}
                </button>
              ))}
              {dynamicPages.length > 0 && <div className="my-1 border-t" />}
              {dynamicPages.map((pg) => (
                <div key={pg.id} className={`flex items-center gap-1 rounded ${page === pg.id ? 'bg-muted' : ''}`}>
                  <button type="button" onClick={() => switchPage(pg.id)}
                    className={`flex-1 text-left px-3 py-2 text-sm rounded hover:bg-muted truncate ${page === pg.id ? 'font-medium' : ''}`}>
                    {pg.titleEn || pg.slug}
                  </button>
                  <button type="button" title={pg.showInNav ? 'Shown in nav — click to hide' : 'Hidden from nav — click to show'}
                    onClick={(e) => { e.stopPropagation(); togglePageNav(pg) }} className="p-1.5 text-muted-foreground hover:text-foreground">
                    {pg.showInNav ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button type="button" title="Delete page" onClick={(e) => { e.stopPropagation(); deletePage(pg) }} className="p-1.5 mr-1 text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="my-1 border-t" />
              <button type="button" onClick={createPage} className="w-full flex items-center gap-1.5 text-left px-3 py-2 text-sm rounded hover:bg-muted text-primary">
                <FilePlus size={14} /> New page
              </button>
            </div>
          )}
        </div>

        {layoutKey && (
          <div className="relative">
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen((o) => !o)}>
              <Plus size={15} /> Add Block <ChevronDown size={13} />
            </Button>
            {addOpen && (
              <div className="absolute z-50 mt-1 w-60 rounded-md border bg-popover shadow-lg p-1">
                {hiddenSections.filter((s) => !isCustomBlockId(s.id)).map((s) => (
                  <button key={s.id} type="button" onClick={() => addSection(s.id)} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted">
                    Show: {SECTION_LABEL[s.id] ?? s.id}
                  </button>
                ))}
                {hiddenSections.some((s) => isCustomBlockId(s.id)) && (
                  <>
                    <div className="my-1 border-t" />
                    {hiddenSections.filter((s) => isCustomBlockId(s.id)).map((s) => (
                      <button key={s.id} type="button" onClick={() => addSection(s.id)} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted">
                        Show: {BLOCK_TEMPLATES.find((b) => b.type === s.type)?.label ?? 'Block'}
                      </button>
                    ))}
                  </>
                )}
                <div className="my-1 border-t" />
                <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">New block</div>
                {BLOCK_TEMPLATES.map((b) => (
                  <button key={b.type} type="button" onClick={() => addCustomBlock(b.type)} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted">
                    + {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="inline-flex rounded-md border overflow-hidden bg-background">
          <button type="button" onClick={() => setDevice('desktop')} className={`px-2.5 py-1.5 ${device === 'desktop' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} title="Desktop"><Monitor size={15} /></button>
          <button type="button" onClick={() => setDevice('phone')} className={`px-2.5 py-1.5 border-l ${device === 'phone' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} title="Phone"><Smartphone size={15} /></button>
        </div>

        <div className="inline-flex rounded-md border overflow-hidden bg-background">
          <button type="button" onClick={() => switchLang('hy')} className={`px-3 py-1.5 text-sm ${lang === 'hy' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Հայ</button>
          <button type="button" onClick={() => switchLang('en')} className={`px-3 py-1.5 text-sm border-l ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Eng</button>
        </div>

        <div className="inline-flex rounded-md border overflow-hidden bg-background">
          <button type="button" onClick={undo} disabled={!history.past.length} className="px-2.5 py-1.5 hover:bg-muted disabled:opacity-40" title="Undo"><Undo2 size={15} /></button>
          <button type="button" onClick={redo} disabled={!history.future.length} className="px-2.5 py-1.5 border-l hover:bg-muted disabled:opacity-40" title="Redo"><Redo2 size={15} /></button>
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSeoOpen(true); setHistoryOpen(false) }}>
          <Search size={14} /> SEO
        </Button>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={openHistory}>
          <History size={14} /> History
        </Button>

        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1"><ExternalLink size={13} /> Live site</a>

        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs ${dirty ? 'text-amber-600' : 'text-muted-foreground'}`}>{dirty ? 'Unsaved' : 'Saved'}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || !dirty}><Save size={14} /> {saving ? 'Saving…' : 'Save draft'}</Button>
          <Button size="sm" className="gap-1.5" onClick={handlePublish} disabled={publishing}><Rocket size={14} /> {publishing ? 'Publishing…' : 'Publish'}</Button>
        </div>
      </div>

      {seoOpen && (
        <Modal onClose={() => setSeoOpen(false)} title={`${currentPageLabel} — search preview`}>
          <div className="space-y-3">
            <Field label={`Page title · ${lang === 'hy' ? 'HY' : 'EN'}`}>
              <Input value={seoTitle ?? ''} onFocus={commit} onChange={(e) => setField(seoTitlePath, e.target.value)} />
            </Field>
            <Field label={`Description · ${lang === 'hy' ? 'HY' : 'EN'}`}>
              <Textarea rows={3} value={seoDesc ?? ''} onFocus={commit} onChange={(e) => setField(seoDescPath, e.target.value)} />
            </Field>
            <p className="text-xs text-muted-foreground">Shown in the browser tab and search-engine results — not visible on the page itself.</p>
          </div>
        </Modal>
      )}

      {historyOpen && (
        <Modal onClose={() => setHistoryOpen(false)} title="Past publishes">
          <div className="space-y-2">
            {historyList == null && <p className="text-xs text-muted-foreground">Loading…</p>}
            {historyList != null && historyList.length === 0 && (
              <p className="text-xs text-muted-foreground">No past publishes yet — each time you hit Publish, the version it replaces is saved here.</p>
            )}
            {historyList != null && historyList.length > 0 && (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {historyList.map((h) => (
                  <div key={h.index} className="flex items-center justify-between text-xs rounded px-2 py-1.5 hover:bg-muted">
                    <span>{h.publishedAt ? new Date(h.publishedAt).toLocaleString() : 'Unknown time'}</span>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" disabled={restoring} onClick={() => restoreHistory(h.index)}>
                      Restore to draft
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Restoring loads that version into the draft for review — it won't go live until you Publish again.</p>
          </div>
        </Modal>
      )}

      {/* ── FULL-WIDTH CANVAS ── */}
      <div className="rounded-lg border bg-muted/30 flex flex-col">
        <div className="px-3 py-1.5 border-b text-xs text-muted-foreground">Click any text on the page to edit it · hover a section for its controls · changes update live</div>
        <div className="flex-1 overflow-auto flex justify-center p-3" style={{ minHeight: 680 }}>
          <div style={{ width: device === 'phone' ? 390 : '100%', maxWidth: '100%', transition: 'width .2s' }}
            className={device === 'phone' ? 'rounded-2xl border-4 border-foreground/80 overflow-hidden shadow-xl bg-white' : 'rounded-md border bg-white overflow-hidden'}>
            <iframe key={`${page}-${reloadKey}`} ref={iframeRef} title="Landing preview"
              src={`${previewPath}?preview=1&edit=1&k=${reloadKey}`}
              className="w-full block" style={{ height: device === 'phone' ? 780 : 760, border: 0 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
