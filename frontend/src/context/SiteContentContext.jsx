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

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState(defaultContent)

  useEffect(() => {
    let alive = true
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
