import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Save, Rocket, ExternalLink, Undo2, Redo2, Plus, Eye, EyeOff, ChevronDown,
  Monitor, Smartphone, UploadCloud, Trash2, Image as ImageIcon, X,
} from 'lucide-react'
import defaultContent from '../data/content'
import { SECTIONS, resolvePath, EMPHASIS_HINT } from '../data/contentSchema'
import { AVAILABLE_SECTIONS, DEFAULT_LAYOUT, SECTION_LABEL, normalizeLayout } from '../data/landingSections'
import { adminGetSiteContent, adminSaveSiteContent, adminPublishSiteContent, adminUploadImage } from '../api/admin'
import {
  PREVIEW_MSG, PREVIEW_READY_MSG, EDIT_SELECT_MSG, EDIT_ACTION_MSG, EDIT_SET_SELECTED_MSG,
} from '../context/SiteContentContext'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Field } from './ui/AdminShared'

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
const valueEqual = (a, b) =>
  (Array.isArray(a) || Array.isArray(b)) ? JSON.stringify(a ?? []) === JSON.stringify(b ?? []) : (a ?? '') === (b ?? '')

// Swap a section with its nearest ENABLED neighbour in the given direction.
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

export default function SiteEditor({ flash }) {
  const [overrides, setOverrides] = useState(null)
  const [saved, setSaved] = useState(null)
  const [history, setHistory] = useState({ past: [], future: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lang, setLang] = useState('hy')
  const [device, setDevice] = useState('desktop')
  const [selected, setSelected] = useState(null)   // section/page key, or null
  const [uploading, setUploading] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const iframeRef = useRef(null)
  const previewReady = useRef(false)

  const selectedSchema = SECTIONS.find((s) => s.key === selected)
  const previewPath = selectedSchema?.previewPath ?? '/preview'
  const landingIds = new Set(AVAILABLE_SECTIONS.map((s) => s.id))
  const pageSections = SECTIONS.filter((s) => !landingIds.has(s.key))

  // ── load draft ──
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
  const postSelected = useCallback((id) => {
    const win = iframeRef.current?.contentWindow
    if (win && previewReady.current) win.postMessage({ type: EDIT_SET_SELECTED_MSG, id }, window.location.origin)
  }, [])

  // reset ready flag whenever the previewed page changes (iframe reloads)
  useEffect(() => { previewReady.current = false }, [previewPath])
  // push draft into the live preview on every change
  useEffect(() => { if (overrides) postToPreview(overrides) }, [overrides, postToPreview])
  // keep the canvas highlight in sync with the selected block
  useEffect(() => { postSelected(landingIds.has(selected) ? selected : null) }, [selected, postSelected]) // eslint-disable-line

  // ── messages from the canvas ──
  const layoutRef = useRef([])
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      const d = event.data || {}
      if (d.type === PREVIEW_READY_MSG) {
        previewReady.current = true
        postToPreview(overrides || {})
        postSelected(landingIds.has(selected) ? selected : null)
      } else if (d.type === EDIT_SELECT_MSG) {
        setSelected(d.id)
      } else if (d.type === EDIT_ACTION_MSG) {
        handleCanvasAction(d.id, d.action)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, selected, postToPreview, postSelected])

  if (loading || !overrides) return <div className="py-12 text-sm text-muted-foreground">Loading the site editor…</div>

  const layout = normalizeLayout(overrides.__layout ?? DEFAULT_LAYOUT)
  layoutRef.current = layout
  const dirty = JSON.stringify(overrides) !== JSON.stringify(saved)
  const hiddenSections = layout.filter((s) => !s.enabled)

  // ── history ──
  const commit = () => {
    const snap = JSON.stringify(overrides)
    setHistory((h) => (h.past.length && h.past[h.past.length - 1] === snap ? h : { past: [...h.past, snap], future: [] }))
  }
  const undo = () => setHistory((h) => {
    if (!h.past.length) return h
    setOverrides(JSON.parse(h.past[h.past.length - 1]))
    return { past: h.past.slice(0, -1), future: [JSON.stringify(overrides), ...h.future] }
  })
  const redo = () => setHistory((h) => {
    if (!h.future.length) return h
    setOverrides(JSON.parse(h.future[0]))
    return { past: [...h.past, JSON.stringify(overrides)], future: h.future.slice(1) }
  })

  // ── value helpers ──
  const resolved = (fp) => (fp in overrides ? overrides[fp] : getPath(defaultContent, fp))
  const setField = (fp, value) => setOverrides((prev) => {
    const next = { ...prev }
    if (valueEqual(value, getPath(defaultContent, fp))) delete next[fp]
    else next[fp] = value
    return next
  })
  const setLayout = (newLayout) => setOverrides((prev) => ({ ...prev, __layout: newLayout }))

  const toggleSection = (id) => { commit(); setLayout(layout.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))) }
  const addSection = (id) => { commit(); setLayout(layout.map((s) => (s.id === id ? { ...s, enabled: true } : s))); setSelected(id); setAddOpen(false) }

  function handleCanvasAction(id, action) {
    if (action === 'settings') { setSelected(id); return }
    if (action === 'hide') { commit(); setLayout(layoutRef.current.map((s) => (s.id === id ? { ...s, enabled: false } : s))); return }
    if (action === 'up' || action === 'down') { commit(); setLayout(moveSection(layoutRef.current, id, action)) }
  }

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
  const switchLang = (l) => { setLang(l); try { localStorage.setItem('hasmik_lang', l) } catch { /* noop */ } previewReady.current = false; setReloadKey((k) => k + 1) }
  const handleUpload = async (fp, file) => {
    if (!file) return
    setUploading(fp); commit()
    try { const { url } = await adminUploadImage(file); setField(fp, url); flash?.('Image uploaded') }
    catch (e) { flash?.(e?.response?.data?.detail || 'Image upload failed', true) }
    finally { setUploading(null) }
  }

  const section = selectedSchema
  const selectedLayout = layout.find((s) => s.id === selected)

  return (
    <div className="space-y-3">
      {/* ── TOP TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="relative">
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen((o) => !o)}>
            <Plus size={15} /> Add Block <ChevronDown size={13} />
          </Button>
          {addOpen && (
            <div className="absolute z-50 mt-1 w-56 rounded-md border bg-popover shadow-lg p-1">
              {hiddenSections.length === 0
                ? <div className="px-3 py-2 text-xs text-muted-foreground">All blocks are visible.</div>
                : hiddenSections.map((s) => (
                  <button key={s.id} type="button" onClick={() => addSection(s.id)}
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted">
                    {SECTION_LABEL[s.id] ?? s.id}
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className="inline-flex rounded-md border overflow-hidden bg-background">
          <button type="button" onClick={() => setDevice('desktop')} className={`px-2.5 py-1.5 ${device === 'desktop' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} title="Desktop"><Monitor size={15} /></button>
          <button type="button" onClick={() => setDevice('phone')} className={`px-2.5 py-1.5 border-l ${device === 'phone' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} title="Phone"><Smartphone size={15} /></button>
        </div>

        <div className="inline-flex rounded-md border overflow-hidden bg-background">
          <button type="button" onClick={undo} disabled={!history.past.length} className="px-2.5 py-1.5 hover:bg-muted disabled:opacity-40" title="Undo"><Undo2 size={15} /></button>
          <button type="button" onClick={redo} disabled={!history.future.length} className="px-2.5 py-1.5 border-l hover:bg-muted disabled:opacity-40" title="Redo"><Redo2 size={15} /></button>
        </div>

        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1"><ExternalLink size={13} /> Live site</a>

        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs ${dirty ? 'text-amber-600' : 'text-muted-foreground'}`}>{dirty ? 'Unsaved' : 'Saved'}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || !dirty}><Save size={14} /> {saving ? 'Saving…' : 'Save draft'}</Button>
          <Button size="sm" className="gap-1.5" onClick={handlePublish} disabled={publishing}><Rocket size={14} /> {publishing ? 'Publishing…' : 'Publish'}</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        {/* ── CANVAS ── */}
        <div className="rounded-lg border bg-muted/30 flex flex-col" style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div className="px-3 py-1.5 border-b text-xs text-muted-foreground">Click a block on the page to edit it · changes update live</div>
          <div className="flex-1 overflow-auto flex justify-center p-3" style={{ minHeight: 620 }}>
            <div style={{ width: device === 'phone' ? 390 : '100%', maxWidth: '100%', transition: 'width .2s' }}
              className={device === 'phone' ? 'rounded-2xl border-4 border-foreground/80 overflow-hidden shadow-xl bg-white' : 'rounded-md border bg-white overflow-hidden'}>
              <iframe key={reloadKey} ref={iframeRef} title="Landing preview"
                src={`${previewPath}?preview=1&edit=1&k=${reloadKey}`}
                className="w-full block" style={{ height: device === 'phone' ? 760 : 700, border: 0 }} />
            </div>
          </div>
        </div>

        {/* ── SETTINGS DRAWER ── */}
        <div className="rounded-lg border bg-card" style={{ width: 340, flexGrow: 0, flexShrink: 0, maxWidth: '100%' }}>
          {/* layers */}
          <div className="p-3 border-b">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Blocks</div>
            <div className="space-y-1">
              {layout.map((s) => (
                <div key={s.id} onClick={() => setSelected(s.id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm ${selected === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'} ${s.enabled ? '' : 'opacity-50'}`}>
                  <span className="flex-1">{SECTION_LABEL[s.id] ?? s.id}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleSection(s.id) }} className="p-0.5" title={s.enabled ? 'Hide' : 'Show'}>
                    {s.enabled ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                  </button>
                </div>
              ))}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-2">Pages</div>
            <div className="space-y-1">
              {pageSections.map((s) => (
                <div key={s.key} onClick={() => setSelected(s.key)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm ${selected === s.key ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                  <span className="flex-1">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">{s.isPage ? 'page' : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* settings for the selected block */}
          <div className="p-4 space-y-4">
            {!section ? (
              <p className="text-sm text-muted-foreground">Select a block to edit its content.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{section.label}</div>
                  <button type="button" onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
                </div>

                {selectedLayout && (
                  <button type="button" onClick={() => toggleSection(selected)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    {selectedLayout.enabled ? <><EyeOff size={13} /> Hide this block</> : <><Eye size={13} /> Show this block</>}
                  </button>
                )}

                <div className="inline-flex rounded-md border overflow-hidden">
                  <button type="button" onClick={() => switchLang('hy')} className={`px-3 py-1 text-sm ${lang === 'hy' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>Հայ</button>
                  <button type="button" onClick={() => switchLang('en')} className={`px-3 py-1 text-sm border-l ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>Eng</button>
                </div>

                {section.fields.map((field) => {
                  const fp = resolvePath(field, lang)
                  const value = resolved(fp)
                  const changed = !valueEqual(value, getPath(defaultContent, fp))
                  const label = field.bilingual ? `${field.label} · ${lang === 'hy' ? 'HY' : 'EN'}` : field.label

                  if (field.type === 'image') {
                    return (
                      <Field key={fp} label={label}>
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-20 rounded-md border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                            {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={16} className="text-muted-foreground" />}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer text-primary">
                              <UploadCloud size={14} /> {uploading === fp ? 'Uploading…' : (value ? 'Replace' : 'Upload')}
                              <input type="file" accept="image/*" className="hidden" disabled={uploading === fp} onChange={(e) => handleUpload(fp, e.target.files?.[0])} />
                            </label>
                            {value
                              ? <button type="button" onClick={() => { commit(); setField(fp, '') }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Trash2 size={12} /> Remove</button>
                              : <span className="text-xs text-muted-foreground">Bundled default</span>}
                          </div>
                        </div>
                      </Field>
                    )
                  }

                  return (
                    <Field key={fp} label={<span className="inline-flex items-center gap-2">{label}{changed && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}</span>}>
                      {changed && <button type="button" onClick={() => { commit(); setField(fp, getPath(defaultContent, fp)) }} className="self-start -mt-0.5 text-xs text-muted-foreground hover:text-foreground">↺ reset</button>}
                      {field.type === 'list' ? (
                        <Textarea rows={Math.max(3, (Array.isArray(value) ? value.length : 0) + 1)} onFocus={commit}
                          value={(Array.isArray(value) ? value : []).join('\n')} onChange={(e) => setField(fp, e.target.value.split('\n'))} placeholder="One item per line" />
                      ) : field.type === 'textarea' ? (
                        <Textarea rows={3} value={value ?? ''} onFocus={commit} onChange={(e) => setField(fp, e.target.value)} />
                      ) : (
                        <Input value={value ?? ''} onFocus={commit} onChange={(e) => setField(fp, e.target.value)} />
                      )}
                      {field.emphasis && <p className="mt-1 text-xs text-muted-foreground">{EMPHASIS_HINT}</p>}
                    </Field>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
