// The set of landing-page sections the Site Editor can show/hide and reorder.
// The global header and footer are always present and are NOT in this list.
// `id` must match the SECTION_COMPONENTS map in App.jsx and the section keys
// in contentSchema.js.
export const AVAILABLE_SECTIONS = [
  { id: 'hero',      label: 'Hero' },
  { id: 'band',      label: 'Accent bar' },
  { id: 'community', label: 'What You Get' },
  { id: 'story',     label: 'Story' },
  { id: 'pricing',   label: 'Pricing' },
  { id: 'finalCta',  label: 'Final CTA' },
]

// Default order + all visible — used when no __layout override exists.
export const DEFAULT_LAYOUT = AVAILABLE_SECTIONS.map((s) => ({ id: s.id, enabled: true }))

export const SECTION_LABEL = Object.fromEntries(AVAILABLE_SECTIONS.map((s) => [s.id, s.label]))

// Reconcile a stored layout with the available sections: keep the stored order,
// drop unknown ids, and append any sections missing from the stored layout
// (disabled) so newly-added section types still appear in the editor.
export function normalizeLayout(stored) {
  const known = new Set(AVAILABLE_SECTIONS.map((s) => s.id))
  const seen = new Set()
  const out = []
  if (Array.isArray(stored)) {
    for (const item of stored) {
      if (item && known.has(item.id) && !seen.has(item.id)) {
        out.push({ id: item.id, enabled: item.enabled !== false })
        seen.add(item.id)
      }
    }
  }
  for (const s of AVAILABLE_SECTIONS) {
    if (!seen.has(s.id)) out.push({ id: s.id, enabled: Array.isArray(stored) ? false : true })
  }
  return out
}
