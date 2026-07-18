import { useState, useEffect } from 'react'
import { ExternalLink, RotateCcw, Save, Undo2 } from 'lucide-react'
import defaultContent from '../data/content'
import { SECTIONS, resolvePath, EMPHASIS_HINT } from '../data/contentSchema'
import { adminGetSiteContent, adminSaveSiteContent } from '../api/admin'
import { Card, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { SectionHeader, Field } from './ui/AdminShared'

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function valueEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
  }
  return (a ?? '') === (b ?? '')
}

// Every editable field flattened to its concrete content path(s) — bilingual
// fields yield both an En and Hy path so edits in either language are kept.
function allFields() {
  const out = []
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (field.bilingual) {
        out.push({ field, fullPath: field.path + 'En' })
        out.push({ field, fullPath: field.path + 'Hy' })
      } else {
        out.push({ field, fullPath: field.path })
      }
    }
  }
  return out
}

export default function SiteEditor({ flash }) {
  const [lang, setLang] = useState('hy')      // Armenian is the primary audience
  const [sectionKey, setSectionKey] = useState(SECTIONS[0].key)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadFrom = (overrides) => {
    const f = {}
    for (const { fullPath } of allFields()) {
      f[fullPath] = overrides && fullPath in overrides
        ? overrides[fullPath]
        : getPath(defaultContent, fullPath)
    }
    setForm(f)
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    adminGetSiteContent()
      .then((overrides) => { if (alive) loadFrom(overrides || {}) })
      .catch(() => flash?.('Failed to load site content', true))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading || !form) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Site Editor" sub="Edit the public landing-page copy" />
        <Card><CardContent className="py-12 text-sm text-muted-foreground">Loading…</CardContent></Card>
      </div>
    )
  }

  const setField = (fullPath, value) => setForm((f) => ({ ...f, [fullPath]: value }))
  const isChanged = (fullPath) => !valueEqual(form[fullPath], getPath(defaultContent, fullPath))
  const resetField = (fullPath) => setField(fullPath, getPath(defaultContent, fullPath))

  const changedCount = allFields().filter(({ fullPath }) => isChanged(fullPath)).length

  const handleSave = async () => {
    setSaving(true)
    const overrides = {}
    for (const { field, fullPath } of allFields()) {
      if (!isChanged(fullPath)) continue
      let value = form[fullPath]
      if (field.type === 'list' && Array.isArray(value)) {
        value = value.map((v) => v.trim()).filter(Boolean)   // drop blank lines
      }
      overrides[fullPath] = value
    }
    try {
      const saved = await adminSaveSiteContent(overrides)
      loadFrom(saved || {})
      flash?.('Saved — reload the landing page to see the changes')
    } catch (e) {
      flash?.(e?.response?.data?.detail || 'Failed to save', true)
    } finally {
      setSaving(false)
    }
  }

  const section = SECTIONS.find((s) => s.key === sectionKey) ?? SECTIONS[0]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Site Editor"
        sub="Edit the public landing-page text. Changes go live after you save."
      />

      {/* toolbar: language toggle · live link · save */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border overflow-hidden">
          <button
            type="button"
            onClick={() => setLang('hy')}
            className={`px-3 py-1.5 text-sm ${lang === 'hy' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
          >Հայերեն</button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 text-sm border-l ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
          >English</button>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink size={14} /> Open live page
        </a>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {changedCount > 0 ? `${changedCount} change${changedCount === 1 ? '' : 's'} from default` : 'No changes'}
          </span>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save size={15} /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* section tabs */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const dirty = s.fields.some((f) => {
            if (f.bilingual) return isChanged(f.path + 'En') || isChanged(f.path + 'Hy')
            return isChanged(f.path)
          })
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSectionKey(s.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                s.key === sectionKey ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
              }`}
            >
              {s.label}{dirty && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />}
            </button>
          )
        })}
      </div>

      {/* fields for the active section + language */}
      <Card>
        <CardContent className="space-y-5 py-6">
          {section.fields.map((field) => {
            const fullPath = resolvePath(field, lang)
            const value = form[fullPath]
            const changed = isChanged(fullPath)
            const label = field.bilingual ? `${field.label} · ${lang === 'hy' ? 'HY' : 'EN'}` : field.label
            return (
              <Field key={fullPath} label={
                <span className="inline-flex items-center gap-2">
                  {label}
                  {changed && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}
                </span>
              }>
                {changed && (
                  <button
                    type="button"
                    onClick={() => resetField(fullPath)}
                    className="self-start -mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Reset this field to the default"
                  >
                    <Undo2 size={12} /> reset to default
                  </button>
                )}
                {field.type === 'list' ? (
                  <Textarea
                    rows={Math.max(3, (Array.isArray(value) ? value.length : 0) + 1)}
                    value={(Array.isArray(value) ? value : []).join('\n')}
                    onChange={(e) => setField(fullPath, e.target.value.split('\n'))}
                    placeholder="One item per line"
                  />
                ) : field.type === 'textarea' ? (
                  <Textarea
                    rows={3}
                    value={value ?? ''}
                    onChange={(e) => setField(fullPath, e.target.value)}
                  />
                ) : (
                  <Input
                    value={value ?? ''}
                    onChange={(e) => setField(fullPath, e.target.value)}
                  />
                )}
                {field.emphasis && (
                  <p className="mt-1 text-xs text-muted-foreground">{EMPHASIS_HINT}</p>
                )}
              </Field>
            )
          })}
        </CardContent>
      </Card>

      {changedCount > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="gap-1.5" onClick={() => {
            setLoading(true)
            adminGetSiteContent()
              .then((o) => loadFrom(o || {}))
              .finally(() => setLoading(false))
          }}>
            <RotateCcw size={15} /> Discard unsaved changes
          </Button>
        </div>
      )}
    </div>
  )
}
