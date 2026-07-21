import { useRef, useEffect, useState } from 'react'
import { UploadCloud, Trash2, Link2, Plus, X, Images, Bold, Sparkles } from 'lucide-react'
import RichText from './RichText'
import { adminUploadImage, adminGetMediaLibrary, adminDeleteMediaLibraryItem } from '../api/admin'
import { EDIT_TEXT_MSG, EDIT_IMAGE_MSG, EDIT_FOCUS_MSG, EDIT_LIST_OP_MSG } from '../context/SiteContentContext'

// True when this document is the Site Editor's editable canvas (/preview?edit=1).
export const IS_EDIT = (() => {
  try { return new URLSearchParams(window.location.search).get('edit') === '1' } catch { return false }
})()

function post(msg) {
  try { window.parent?.postMessage(msg, window.location.origin) } catch { /* noop */ }
}

// A tiny "+ Add <label>" button (edit mode only) that appends an empty entry
// to one or more parallel string-array overrides (see EDIT_LIST_OP_MSG).
export function AddItemButton({ paths, label }) {
  if (!IS_EDIT) return null
  return (
    <button type="button" className="hc-add-item"
      onClick={() => { post({ type: EDIT_FOCUS_MSG }); post({ type: EDIT_LIST_OP_MSG, paths, op: 'add' }) }}>
      <Plus size={13} /> {label}
    </button>
  )
}

// A small "×" control (edit mode only) that removes one entry (by index) from
// one or more parallel string-array overrides — the inverse of AddItemButton.
export function RemoveItemButton({ paths, index }) {
  if (!IS_EDIT) return null
  return (
    <button type="button" className="hc-remove-item" title="Remove"
      onClick={(e) => { e.stopPropagation(); post({ type: EDIT_FOCUS_MSG }); post({ type: EDIT_LIST_OP_MSG, paths, op: 'remove', index }) }}>
      <X size={12} />
    </button>
  )
}
// Inline-editable text. Uncontrolled (textContent set imperatively) so React
// re-renders from live preview updates never fight the caret while typing.
// `multiline` (defaults to true for <p>) lets Enter insert an actual line
// break instead of committing/blurring — without it, a paragraph field felt
// impossible to add a second line to. `emphasis` shows the raw **bold**/*italic*
// markup while editing (RichText renders it live-site-side) and adds small
// Bold/Featured buttons that wrap the current selection — the field must show
// the real markers while editing, otherwise saving would silently drop them.
// "Featured" = *single asterisks* = the club's rose accent color (RichText
// renders it as <em className="hc-featured">), the same treatment already
// used site-wide on headings — this is the admin-facing way to apply it to
// any text, not just bold.
export function E({ as: Tag = 'span', className, style, path, value, emphasis = false, listIndex, multiline }) {
  const ref = useRef(null)
  const focused = useRef(false)
  const isMultiline = multiline ?? (Tag === 'p')

  useEffect(() => {
    if (!IS_EDIT || !ref.current || focused.current) return
    ref.current.textContent = value ?? ''
  }, [value])

  if (!IS_EDIT) {
    return <Tag className={className} style={style}>{emphasis ? <RichText text={value} /> : value}</Tag>
  }

  // Trailing newlines only get trimmed on blur (final commit) — trimming on
  // every keystroke would strip the line break the instant a multiline field
  // gets one (nothing typed after it yet), which is exactly when a live
  // preview round-trip could clobber it back into the still-focused field.
  const send = (el, { trim = false } = {}) => {
    let v = el.innerText
    if (trim) v = v.replace(/\n+$/, '')
    post({ type: EDIT_TEXT_MSG, path, value: v, listIndex })
  }
  const wrapSelection = (marker) => {
    const el = ref.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
    const selected = sel.toString()
    if (!selected) return
    document.execCommand('insertText', false, `${marker}${selected}${marker}`)
    send(el)
  }

  const field = (
    <Tag
      ref={ref}
      className={`${className || ''} hc-editable`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      data-hc-path={path}
      onFocus={() => { focused.current = true; post({ type: EDIT_FOCUS_MSG }) }}
      onBlur={(e) => { focused.current = false; send(e.currentTarget, { trim: true }) }}
      onInput={(e) => send(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (isMultiline) document.execCommand('insertLineBreak')
        else e.currentTarget.blur()
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )

  if (!emphasis) return field
  return (
    <span className="hc-emphasis-wrap" onClick={(e) => e.stopPropagation()}>
      {field}
      <span className="hc-emphasis-btns">
        <button type="button" className="hc-bold-btn" title="Select text, then click to make it bold"
          onMouseDown={(e) => { e.preventDefault(); wrapSelection('**') }}>
          <Bold size={12} />
        </button>
        <button type="button" className="hc-featured-btn" title="Select text, then click to give it Hasmik's Club's featured color"
          onMouseDown={(e) => { e.preventDefault(); wrapSelection('*') }}>
          <Sparkles size={12} />
        </button>
      </span>
    </span>
  )
}

// Image with hover-to-replace / remove controls (edit mode only). Uploads run
// in this iframe (it shares the admin session), then post the URL to the editor.
export function EditableImage({ src, alt, className, style, path }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [library, setLibrary] = useState(null)

  if (!IS_EDIT) return <img src={src} alt={alt} className={className} style={style} />

  const onFile = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const { url } = await adminUploadImage(file)
      post({ type: EDIT_FOCUS_MSG })
      post({ type: EDIT_IMAGE_MSG, path, url })
    } catch { /* editor shows nothing here; failure is rare */ }
    finally { setBusy(false) }
  }

  const openLibrary = async () => {
    setLibraryOpen((o) => !o)
    if (library == null) {
      try { setLibrary(await adminGetMediaLibrary()) } catch { setLibrary([]) }
    }
  }
  const pick = (url) => {
    post({ type: EDIT_FOCUS_MSG })
    post({ type: EDIT_IMAGE_MSG, path, url })
    setLibraryOpen(false)
  }
  const removeFromLibrary = async (e, url) => {
    e.stopPropagation()
    setLibrary((cur) => (cur || []).filter((u) => u !== url))
    try { await adminDeleteMediaLibraryItem(url) } catch { /* best effort */ }
  }

  return (
    <span className="hc-img-wrap" onClick={(e) => e.stopPropagation()}>
      <img src={src} alt={alt} className={className} style={style} />
      <span className="hc-img-controls">
        <button type="button" onClick={() => inputRef.current?.click()}>
          <UploadCloud size={14} /> {busy ? 'Uploading…' : 'Replace'}
        </button>
        <button type="button" onClick={openLibrary}>
          <Images size={14} /> Library
        </button>
        <button type="button" onClick={() => { post({ type: EDIT_FOCUS_MSG }); post({ type: EDIT_IMAGE_MSG, path, url: '' }) }}>
          <Trash2 size={14} /> Remove
        </button>
      </span>
      {libraryOpen && (
        <div className="hc-media-lib" onClick={(e) => e.stopPropagation()}>
          <div className="hc-media-lib-title">Media library</div>
          {library == null && <div className="hc-media-lib-empty">Loading…</div>}
          {library != null && library.length === 0 && <div className="hc-media-lib-empty">No uploaded images yet</div>}
          {library != null && library.length > 0 && (
            <div className="hc-media-lib-grid">
              {library.map((url) => (
                <span key={url} className="hc-media-lib-item" onClick={() => pick(url)}>
                  <img src={url} alt="" />
                  <button type="button" className="hc-media-lib-del" title="Remove from library" onClick={(e) => removeFromLibrary(e, url)}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </span>
  )
}

// Wraps an embed (Instagram reel) with an editable URL bar in edit mode. The
// embed itself stays as `children`; applying a new URL posts it as an override.
export function EditableReel({ path, value, children }) {
  const [url, setUrl] = useState(value || '')
  useEffect(() => { setUrl(value || '') }, [value])

  if (!IS_EDIT) return children

  const apply = () => {
    post({ type: EDIT_FOCUS_MSG })
    post({ type: EDIT_TEXT_MSG, path, value: url.trim() })
  }
  return (
    <div className="hc-embed-wrap" onClick={(e) => e.stopPropagation()}>
      <div className="hc-embed-edit">
        <Link2 size={14} />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); e.currentTarget.blur() } }}
          placeholder="Instagram reel URL"
        />
        <button type="button" onClick={apply}>Apply</button>
      </div>
      {children}
    </div>
  )
}

// A CTA href may be an internal route ("/register", "#pricing") or a full
// external URL the admin pasted in (e.g. a Telegram invite) — this tells the
// caller which kind of anchor to render.
export const isExternalHref = (href) => /^https?:\/\//i.test(href || '')

// Wraps a fixed-section CTA (Hero/FinalCta button) with a small "edit link
// destination" control (edit mode only) — the button's visible text stays
// editable via the normal <E>, this only changes where it navigates to.
export function EditableLinkHref({ path, value, children }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(value || '')
  useEffect(() => { setUrl(value || '') }, [value])

  if (!IS_EDIT) return children

  const apply = () => {
    post({ type: EDIT_FOCUS_MSG })
    post({ type: EDIT_TEXT_MSG, path, value: url.trim() || '/register' })
    setOpen(false)
  }
  return (
    <span className="hc-cta-wrap" onClick={(e) => e.stopPropagation()}>
      {children}
      <button type="button" className="hc-cta-link-btn" title="Edit link destination" onClick={() => setOpen((o) => !o)}>
        <Link2 size={12} />
      </button>
      {open && (
        <span className="hc-cta-link-pop">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
            placeholder="/register or https://…"
          />
          <button type="button" onClick={apply}>Apply</button>
        </span>
      )}
    </span>
  )
}

// In edit mode, keep links/buttons inert so clicking to edit never navigates.
export function installEditGuards() {
  if (!IS_EDIT) return
  const handler = (e) => {
    const a = e.target.closest?.('a, button')
    if (!a) return
    if (a.closest('.hc-block-toolbar, .hc-img-controls, .hc-embed-edit, .hc-cta-link-btn, .hc-cta-link-pop, .hc-media-lib')) return   // editor chrome stays live
    e.preventDefault()
  }
  document.addEventListener('click', handler, true)
}
