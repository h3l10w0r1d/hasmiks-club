import { BLOCK_TEMPLATES } from './landingSections'

// Admin-created pages beyond the fixed set (landing/about/contact/events/terms).
// The list itself lives at the reserved content override key "__pages"; each
// page's own block layout lives at the nested reserved key
// "page.<id>.__layout" (an array of {id, enabled, type} — same shape as the
// landing page's __layout, but only ever containing custom blocks since a
// fresh page starts as a blank canvas). Block content re-uses the existing
// "custom.<blockId>.*" override namespace (see CustomBlock.jsx) — block ids
// are random enough that there's no collision risk across pages.
export const PAGES_KEY = '__pages'

export const newPageId = () => `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export function slugify(title) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'page'
}

// Ensure a slug is unique among existing pages by appending -2, -3, ... as needed.
export function uniqueSlug(base, existingSlugs) {
  if (!existingSlugs.includes(base)) return base
  let n = 2
  while (existingSlugs.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

// Reconcile a stored page's block layout: keep the stored order, drop
// anything that isn't a recognized custom-block entry.
export function normalizePageLayout(stored) {
  if (!Array.isArray(stored)) return []
  const out = []
  const seen = new Set()
  for (const item of stored) {
    if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) continue
    const validType = BLOCK_TEMPLATES.some((b) => b.type === item.type) ? item.type : 'text'
    out.push({ id: item.id, enabled: item.enabled !== false, type: validType })
    seen.add(item.id)
  }
  return out
}
