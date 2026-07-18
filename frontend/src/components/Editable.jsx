import { useRef, useEffect, useState } from 'react'
import { UploadCloud, Trash2 } from 'lucide-react'
import RichText from './RichText'
import { adminUploadImage } from '../api/admin'
import { EDIT_TEXT_MSG, EDIT_IMAGE_MSG, EDIT_FOCUS_MSG } from '../context/SiteContentContext'

// True when this document is the Site Editor's editable canvas (/preview?edit=1).
export const IS_EDIT = (() => {
  try { return new URLSearchParams(window.location.search).get('edit') === '1' } catch { return false }
})()

function post(msg) {
  try { window.parent?.postMessage(msg, window.location.origin) } catch { /* noop */ }
}
const stripMarkers = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/\*/g, '')

// Inline-editable text. Uncontrolled (textContent set imperatively) so React
// re-renders from live preview updates never fight the caret while typing.
export function E({ as: Tag = 'span', className, path, value, emphasis = false, listIndex }) {
  const ref = useRef(null)
  const focused = useRef(false)

  useEffect(() => {
    if (!IS_EDIT || !ref.current || focused.current) return
    ref.current.textContent = emphasis ? stripMarkers(value) : (value ?? '')
  }, [value, emphasis])

  if (!IS_EDIT) {
    return <Tag className={className}>{emphasis ? <RichText text={value} /> : value}</Tag>
  }

  const send = (el) => post({ type: EDIT_TEXT_MSG, path, value: el.innerText.replace(/\n+$/,''), listIndex })
  return (
    <Tag
      ref={ref}
      className={`${className || ''} hc-editable`}
      contentEditable
      suppressContentEditableWarning
      data-hc-path={path}
      onFocus={() => { focused.current = true; post({ type: EDIT_FOCUS_MSG }) }}
      onBlur={(e) => { focused.current = false; send(e.currentTarget) }}
      onInput={(e) => send(e.currentTarget)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

// Image with hover-to-replace / remove controls (edit mode only). Uploads run
// in this iframe (it shares the admin session), then post the URL to the editor.
export function EditableImage({ src, alt, className, style, path }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

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

  return (
    <span className="hc-img-wrap" onClick={(e) => e.stopPropagation()}>
      <img src={src} alt={alt} className={className} style={style} />
      <span className="hc-img-controls">
        <button type="button" onClick={() => inputRef.current?.click()}>
          <UploadCloud size={14} /> {busy ? 'Uploading…' : 'Replace'}
        </button>
        <button type="button" onClick={() => { post({ type: EDIT_FOCUS_MSG }); post({ type: EDIT_IMAGE_MSG, path, url: '' }) }}>
          <Trash2 size={14} /> Remove
        </button>
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </span>
  )
}

// In edit mode, keep links/buttons inert so clicking to edit never navigates.
export function installEditGuards() {
  if (!IS_EDIT) return
  const handler = (e) => {
    const a = e.target.closest?.('a, button')
    if (!a) return
    if (a.closest('.hc-block-toolbar, .hc-img-controls')) return   // editor chrome stays live
    e.preventDefault()
  }
  document.addEventListener('click', handler, true)
}
