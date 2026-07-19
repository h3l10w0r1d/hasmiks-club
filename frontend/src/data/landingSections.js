// The set of landing-page sections the Site Editor can show/hide and reorder.
// The global header and footer are always present and are NOT in this list.
// `id` must match the SECTION_COMPONENTS map in App.jsx.
export const AVAILABLE_SECTIONS = [
  { id: 'hero',      label: 'Hero' },
  { id: 'band',      label: 'Accent bar' },
  { id: 'community', label: 'What You Get' },
  { id: 'story',     label: 'Story' },
  { id: 'pricing',   label: 'Pricing' },
  { id: 'finalCta',  label: 'Final CTA' },
]

// Fresh, from-scratch block types addable via "Add Block" beyond the fixed
// designed sections above. Each added instance gets its own __layout entry
// with id "custom-<random>" and this `type`, and its text/image lives under
// content overrides at "custom.<id>.*" (see CustomBlock.jsx).
export const BLOCK_TEMPLATES = [
  { type: 'text', label: 'Text Block' },
  { type: 'imageText', label: 'Image + Text' },
  { type: 'testimonial', label: 'Testimonial' },
  { type: 'stats', label: 'Stats' },
  { type: 'faq', label: 'FAQ' },
]
export const BLOCK_TEMPLATE_LABEL = Object.fromEntries(BLOCK_TEMPLATES.map((b) => [b.type, b.label]))

// Initial content written into a block's `custom.<id>.*` overrides the moment
// it's added (not just shown as a cosmetic placeholder). This matters for the
// repeatable-array fields (paragraphs, stat pairs, FAQ rows): if "Add" only ever
// saw a placeholder that was never actually stored, the first click would
// replace the placeholder with one blank item instead of adding a second one.
// Seeding real starting content here means Add/Remove always operate on an
// array that's genuinely there from block #1.
export const BLOCK_SEED = {
  text: {
    headingEn: 'Add a heading', headingHy: 'Ավելացրեք վերնագիր',
    itemsEn: ['Write your text here…'], itemsHy: ['Գրեք ձեր տեքստը այստեղ…'],
  },
  imageText: {
    headingEn: 'Add a heading', headingHy: 'Ավելացրեք վերնագիր',
    itemsEn: ['Write your text here…'], itemsHy: ['Գրեք ձեր տեքստը այստեղ…'],
  },
  testimonial: {
    quoteEn: `"A happy member's story goes here."`, quoteHy: '«Երջանիկ անդամի պատմությունը գրեք այստեղ»',
    nameEn: 'Member name', nameHy: 'Անդամի անուն',
  },
  stats: {
    headingEn: 'Add a heading', headingHy: 'Ավելացրեք վերնագիր',
    numbersEn: ['100', '100', '100'], numbersHy: ['100', '100', '100'],
    statLabelsEn: ['Label', 'Label', 'Label'], statLabelsHy: ['Պիտակ', 'Պիտակ', 'Պիտակ'],
  },
  faq: {
    headingEn: 'Add a heading', headingHy: 'Ավելացրեք վերնագիր',
    questionsEn: ['Question goes here?', 'Question goes here?'], questionsHy: ['Հարցը գրեք այստեղ', 'Հարցը գրեք այստեղ'],
    answersEn: ['Answer goes here.', 'Answer goes here.'], answersHy: ['Պատասխանը գրեք այստեղ', 'Պատասխանը գրեք այստեղ'],
  },
}

export const isCustomBlockId = (id) => typeof id === 'string' && id.startsWith('custom-')
export const newCustomBlockId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// Default order + all visible — used when no __layout override exists.
export const DEFAULT_LAYOUT = AVAILABLE_SECTIONS.map((s) => ({ id: s.id, enabled: true }))

export const SECTION_LABEL = Object.fromEntries(AVAILABLE_SECTIONS.map((s) => [s.id, s.label]))

// Reconcile a stored layout with the available sections: keep the stored order,
// drop unknown ids (except custom blocks, which are dynamic and always kept),
// and append any fixed sections missing from the stored layout (disabled) so
// newly-added section types still appear in the editor.
export function normalizeLayout(stored) {
  const known = new Set(AVAILABLE_SECTIONS.map((s) => s.id))
  const seen = new Set()
  const out = []
  if (Array.isArray(stored)) {
    for (const item of stored) {
      if (!item || !item.id || seen.has(item.id)) continue
      if (known.has(item.id)) {
        out.push({ id: item.id, enabled: item.enabled !== false })
        seen.add(item.id)
      } else if (isCustomBlockId(item.id)) {
        const validType = BLOCK_TEMPLATES.some((b) => b.type === item.type) ? item.type : 'text'
        out.push({ id: item.id, enabled: item.enabled !== false, type: validType })
        seen.add(item.id)
      }
    }
  }
  for (const s of AVAILABLE_SECTIONS) {
    if (!seen.has(s.id)) out.push({ id: s.id, enabled: Array.isArray(stored) ? false : true })
  }
  return out
}
