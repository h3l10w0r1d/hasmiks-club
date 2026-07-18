import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Save, Rocket, ExternalLink, Undo2, GripVertical, Eye, EyeOff,
  Monitor, Smartphone, UploadCloud, Trash2, Image as ImageIcon,
} from 'lucide-react'
import defaultContent from '../data/content'
import { SECTIONS, resolvePath, EMPHASIS_HINT } from '../data/contentSchema'
import { AVAILABLE_SECTIONS, DEFAULT_LAYOUT, SECTION_LABEL, normalizeLayout } from '../data/landingSections'
import { adminGetSiteContent, adminSaveSiteContent, adminPublishSiteContent, adminUploadImage } from '../api/admin'
import { PREVIEW_MSG, PREVIEW_READY_MSG } from '../context/SiteContentContext'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Field } from './ui/AdminShared'

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}
function valueEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
  return (a ?? '') === (b ?? '')
}

export default function SiteEditor({ flash }) {
  const [overrides, setOverrides] = useState(null)      // draft map incl __layout
  const [saved, setSaved] = useState(null)              // last-saved draft (for dirty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lang, setLang] = useState('hy')
  const [device, setDevice] = useState('desktop')
  const [selected, setSelected] = useState('hero')
  const [uploading, setUploading] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const iframeRef = useRef(null)
  const previewReady = useRef(false)
  const dragFrom = useRef(null)

  // Which page the preview iframe shows: landing (/preview) or a standalone
  // page like /about, based on the schema of whatever section is selected.
  const selectedSchema = SECTIONS.find((s) => s.key === selected)
  const previewPath = selectedSchema?.previewPath ?? '/preview'
  const landingIds = new Set(AVAILABLE_SECTIONS.map((s) => s.id))
  const otherSections = SECTIONS.filter((s) => !landingIds.has(s.key))

  // ── load draft ──
  useEffect(() => {
    let alive = true
    adminGetSiteContent('draft')
      .then((data) => {
        if (!alive) return
        const o = data && typeof data === 'object' ? data : {}
        setOverrides(o)
        setSaved(o)
      })
      .catch(() => flash?.('Failed to load site content', true))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const postToPreview = useCallback((o) => {
    const win = iframeRef.current?.contentWindow
    if (win && previewReady.current) {
      win.postMessage({ type: PREVIEW_MSG, overrides: o }, window.location.origin)
    }
  }, [])

  // ── receive READY from the preview iframe, then feed it the current draft ──
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      if (event.data && event.data.type === PREVIEW_READY_MSG) {
        previewReady.current = true
        postToPreview(overrides || {})
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [overrides, postToPreview])

  // ── push every draft change into the live preview ──
  useEffect(() => { if (overrides) postToPreview(overrides) }, [overrides, postToPreview])

  // when the previewed page changes the iframe reloads; wait for its next READY
  useEffect(() => { previewReady.current = false }, [previewPath])

  if (loading || !overrides) {
    return <div className="py-12 text-sm text-muted-foreground">Loading the site editor…</div>
  }

  const layout = normalizeLayout(overrides.__layout ?? DEFAULT_LAYOUT)
  const dirty = JSON.stringify(overrides) !== JSON.stringify(saved)

  // ── value helpers ──
  const resolved = (fp) => (fp in overrides ? overrides[fp] : getPath(defaultContent, fp))
  const setField = (fp, value) => {
    setOverrides((prev) => {
      const next = { ...prev }
      if (valueEqual(value, getPath(defaultContent, fp))) delete next[fp]
      else next[fp] = value
      return next
    })
  }
  const setLayout = (newLayout) => setOverrides((prev) => ({ ...prev, __layout: newLayout }))

  // ── layout ops ──
  const toggleSection = (id) => setLayout(layout.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)))
  const onDrop = (toIdx) => {
    const from = dragFrom.current
    dragFrom.current = null
    if (from == null || from === toIdx) return
    const next = [...layout]
    const [moved] = next.splice(from, 1)
    next.splice(toIdx, 0, moved)
    setLayout(next)
  }

  // ── save / publish ──
  const handleSave = async () => {
    setSaving(true)
    try {
      const savedData = await adminSaveSiteContent(overrides)
      setSaved(savedData)
      flash?.('Draft saved')
    } catch (e) {
      flash?.(e?.response?.data?.detail || 'Failed to save draft', true)
    } finally { setSaving(false) }
  }
  const handlePublish = async () => {
    setPublishing(true)
    try {
      await adminSaveSiteContent(overrides)   // publish promotes the stored draft
      setSaved(overrides)
      await adminPublishSiteContent()
      flash?.('Published — the changes are now live')
    } catch (e) {
      flash?.(e?.response?.data?.detail || 'Failed to publish', true)
    } finally { setPublishing(false) }
  }

  // ── language: reload the preview so it renders in the edited language ──
  const switchLang = (l) => {
    setLang(l)
    try { localStorage.setItem('hasmik_lang', l) } catch { /* noop */ }
    previewReady.current = false
    setReloadKey((k) => k + 1)
  }

  // ── image upload ──
  const handleUpload = async (fp, file) => {
    if (!file) return
    setUploading(fp)
    try {
      const { url } = await adminUploadImage(file)
      setField(fp, url)
      flash?.('Image uploaded')
    } catch (e) {
      flash?.(e?.response?.data?.detail || 'Image upload failed', true)
    } finally { setUploading(null) }
  }

  const section = selectedSchema ?? SECTIONS[0]

  return (
    <div className="space-y-4">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Site Editor</h2>
          <p className="text-xs text-muted-foreground">Edit the landing page with a live preview. Save a draft, then publish to go live.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs ${dirty ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {dirty ? 'Unsaved changes' : 'Draft saved'}
          </span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || !dirty}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handlePublish} disabled={publishing}>
            <Rocket size={14} /> {publishing ? 'Publishing…' : 'Publish to live'}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* ── LEFT: controls ── */}
        <div className="space-y-4" style={{ width: 380, flexGrow: 0, flexShrink: 0, maxWidth: '100%' }}>
          {/* section manager */}
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sections — drag to reorder</div>
            <div className="space-y-1">
              {layout.map((s, idx) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => { dragFrom.current = idx }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(idx)}
                  onClick={() => setSelected(s.id)}
                  className={`group flex items-center gap-2 rounded-md border px-2 py-2 cursor-pointer transition-colors ${
                    selected === s.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'
                  } ${s.enabled ? '' : 'opacity-50'}`}
                >
                  <GripVertical size={15} className="text-muted-foreground cursor-grab shrink-0" />
                  <span className="flex-1 text-sm">{SECTION_LABEL[s.id] ?? s.id}</span>
                  {SECTIONS.some((sec) => sec.key === s.id) && (
                    <span className="text-[10px] text-muted-foreground">edit</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSection(s.id) }}
                    className="p-1 rounded hover:bg-muted-foreground/10 shrink-0"
                    title={s.enabled ? 'Hide section' : 'Show section'}
                  >
                    {s.enabled ? <Eye size={15} /> : <EyeOff size={15} className="text-muted-foreground" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* pages & elements (not part of the landing layout) */}
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Pages & elements</div>
            <div className="space-y-1">
              {otherSections.map((s) => (
                <div
                  key={s.key}
                  onClick={() => setSelected(s.key)}
                  className={`flex items-center gap-2 rounded-md border px-2 py-2 cursor-pointer transition-colors ${
                    selected === s.key ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'
                  }`}
                >
                  <span className="flex-1 text-sm">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">{s.isPage ? 'page' : 'edit'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* language toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Editing language:</span>
            <div className="inline-flex rounded-md border overflow-hidden">
              <button type="button" onClick={() => switchLang('hy')} className={`px-3 py-1 text-sm ${lang === 'hy' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>Հայերեն</button>
              <button type="button" onClick={() => switchLang('en')} className={`px-3 py-1 text-sm border-l ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>English</button>
            </div>
          </div>

          {/* fields for the selected section */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="text-sm font-semibold">{selectedSchema?.label ?? SECTION_LABEL[selected] ?? selected}</div>
            {section.key !== selected ? (
              <p className="text-sm text-muted-foreground">This section has no editable text.</p>
            ) : section.fields.map((field) => {
              const fp = resolvePath(field, lang)
              const value = resolved(fp)
              const changed = !valueEqual(value, getPath(defaultContent, fp))
              const label = field.bilingual ? `${field.label} · ${lang === 'hy' ? 'HY' : 'EN'}` : field.label

              if (field.type === 'image') {
                return (
                  <Field key={fp} label={label}>
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-24 rounded-md border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={18} className="text-muted-foreground" />}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer text-primary">
                          <UploadCloud size={14} /> {uploading === fp ? 'Uploading…' : (value ? 'Replace' : 'Upload')}
                          <input type="file" accept="image/*" className="hidden" disabled={uploading === fp}
                            onChange={(e) => handleUpload(fp, e.target.files?.[0])} />
                        </label>
                        {value && (
                          <button type="button" onClick={() => setField(fp, '')} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <Trash2 size={12} /> Remove (use default)
                          </button>
                        )}
                        {!value && <span className="text-xs text-muted-foreground">Using bundled default</span>}
                      </div>
                    </div>
                  </Field>
                )
              }

              return (
                <Field key={fp} label={
                  <span className="inline-flex items-center gap-2">{label}{changed && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}</span>
                }>
                  {changed && (
                    <button type="button" onClick={() => setField(fp, getPath(defaultContent, fp))} className="self-start -mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Undo2 size={12} /> reset to default
                    </button>
                  )}
                  {field.type === 'list' ? (
                    <Textarea rows={Math.max(3, (Array.isArray(value) ? value.length : 0) + 1)}
                      value={(Array.isArray(value) ? value : []).join('\n')}
                      onChange={(e) => setField(fp, e.target.value.split('\n'))}
                      placeholder="One item per line" />
                  ) : field.type === 'textarea' ? (
                    <Textarea rows={3} value={value ?? ''} onChange={(e) => setField(fp, e.target.value)} />
                  ) : (
                    <Input value={value ?? ''} onChange={(e) => setField(fp, e.target.value)} />
                  )}
                  {field.emphasis && <p className="mt-1 text-xs text-muted-foreground">{EMPHASIS_HINT}</p>}
                </Field>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: live preview ── */}
        <div className="rounded-lg border bg-muted/30 flex flex-col" style={{ flex: '1 1 520px', minWidth: 0 }}>
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <div className="inline-flex rounded-md border overflow-hidden bg-background">
              <button type="button" onClick={() => setDevice('desktop')} className={`px-2.5 py-1 ${device === 'desktop' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} title="Desktop"><Monitor size={15} /></button>
              <button type="button" onClick={() => setDevice('phone')} className={`px-2.5 py-1 border-l ${device === 'phone' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} title="Phone"><Smartphone size={15} /></button>
            </div>
            <span className="text-xs text-muted-foreground">Live preview · updates as you type</span>
            <a href="/" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink size={13} /> Open live site
            </a>
          </div>
          <div className="flex-1 overflow-auto flex justify-center p-3" style={{ minHeight: 640 }}>
            <div style={{ width: device === 'phone' ? 390 : '100%', maxWidth: '100%', transition: 'width .2s' }}
              className={device === 'phone' ? 'rounded-2xl border-4 border-foreground/80 overflow-hidden shadow-xl bg-white' : 'rounded-md border bg-white overflow-hidden'}>
              <iframe
                key={reloadKey}
                ref={iframeRef}
                title="Landing preview"
                src={`${previewPath}?preview=1&k=${reloadKey}`}
                className="w-full block"
                style={{ height: device === 'phone' ? 780 : 720, border: 0 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
