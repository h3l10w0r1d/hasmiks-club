import { createContext, useContext, useEffect, useState } from 'react'
import defaultContent from '../data/content'
import { getSiteContent } from '../api/payments'

// The landing page reads its copy from this context instead of importing the
// static content module directly, so admin edits made in the Site Editor take
// effect at runtime. Defaults are the bundled content module; overrides are a
// flat { "dotted.path": value } map fetched from the backend and deep-applied.

const SiteContentContext = createContext(defaultContent)

function setPath(obj, path, value) {
  const keys = path.split('.')
  let node = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (node[k] == null || typeof node[k] !== 'object') node[k] = {}
    node = node[k]
  }
  node[keys[keys.length - 1]] = value
}

// Clone defaults and write each override onto its dotted path. Unknown/broken
// paths are skipped rather than throwing, so one bad key can't blank the page.
export function applyOverrides(base, overrides) {
  const clone = typeof structuredClone === 'function'
    ? structuredClone(base)
    : JSON.parse(JSON.stringify(base))
  if (overrides && typeof overrides === 'object') {
    for (const [path, value] of Object.entries(overrides)) {
      try { setPath(clone, path, value) } catch { /* ignore malformed path */ }
    }
  }
  return clone
}

// When the landing page is embedded in the Site Editor's live preview it loads
// with ?preview=1. In that mode it does NOT fetch published content; instead it
// renders whatever draft overrides the editor posts to it via postMessage, so
// edits appear instantly as you type.
function isPreviewMode() {
  try {
    return new URLSearchParams(window.location.search).get('preview') === '1'
  } catch {
    return false
  }
}

export const PREVIEW_MSG = 'HC_SITE_PREVIEW'                 // parent -> iframe: overrides
export const PREVIEW_READY_MSG = 'HC_SITE_PREVIEW_READY'     // iframe -> parent: ready for content
// On-canvas block editing (child iframe <-> editor):
export const EDIT_SELECT_MSG = 'HC_EDIT_SELECT'             // iframe -> parent: a block was clicked {id}
export const EDIT_ACTION_MSG = 'HC_EDIT_ACTION'            // iframe -> parent: toolbar action {id, action}
export const EDIT_SET_SELECTED_MSG = 'HC_EDIT_SET_SELECTED' // parent -> iframe: highlight this block {id}

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState(defaultContent)

  useEffect(() => {
    let alive = true

    if (isPreviewMode()) {
      const onMessage = (event) => {
        if (event.origin !== window.location.origin) return
        if (event.data && event.data.type === PREVIEW_MSG) {
          setContent(applyOverrides(defaultContent, event.data.overrides || {}))
        }
      }
      window.addEventListener('message', onMessage)
      // tell the editor we're ready to receive the first draft payload
      try { window.parent?.postMessage({ type: PREVIEW_READY_MSG }, window.location.origin) } catch { /* noop */ }
      return () => { window.removeEventListener('message', onMessage) }
    }

    getSiteContent()
      .then((overrides) => {
        if (alive && overrides && Object.keys(overrides).length) {
          setContent(applyOverrides(defaultContent, overrides))
        }
      })
      .catch(() => { /* keep bundled defaults if the fetch fails */ })
    return () => { alive = false }
  }, [])

  return (
    <SiteContentContext.Provider value={content}>
      {children}
    </SiteContentContext.Provider>
  )
}

export function useContent() {
  return useContext(SiteContentContext)
}
