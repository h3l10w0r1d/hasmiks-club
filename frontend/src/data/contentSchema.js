// Drives the admin Site Editor. Each field maps to a path in the content
// module (src/data/content.js). For `bilingual` fields the path is a BASE and
// the editor appends `En` / `Hy` per the active language tab (e.g. base
// `hero.h1` -> `hero.h1En` / `hero.h1Hy`). Non-bilingual fields use the path
// verbatim (e.g. a price that's the same in both languages).
//
// Field types: 'text' (single line), 'textarea' (multi-line), 'list' (one item
// per line, stored as an array). Emphasis: wrap words in *italic* or **bold**;
// use a line break for a new line (rendered via the RichText component).

export const EMPHASIS_HINT = 'Wrap words in *italic* or **bold** for accent styling.'

export const SECTIONS = [
  {
    key: 'hero',
    label: 'Hero',
    fields: [
      { path: 'hero.eyebrow', label: 'Eyebrow (small label)', type: 'text', bilingual: true },
      { path: 'hero.h1', label: 'Headline', type: 'textarea', bilingual: true, emphasis: true },
      { path: 'hero.p', label: 'Paragraph', type: 'textarea', bilingual: true, emphasis: true },
      { path: 'hero.pill', label: 'Photo quote', type: 'textarea', bilingual: true },
      { path: 'hero.join', label: 'Button label', type: 'text', bilingual: true },
      { path: 'hero.stat1Label', label: 'Stat 1 label (under 40K)', type: 'text', bilingual: true },
      { path: 'hero.stat2Label', label: 'Stat 2 label (under 2)', type: 'text', bilingual: true },
      { path: 'hero.stat3Label', label: 'Stat 3 label (under #1)', type: 'text', bilingual: true },
    ],
  },
  {
    key: 'community',
    label: 'What You Get',
    fields: [
      { path: 'community.tag', label: 'Section tag', type: 'text', bilingual: true },
      { path: 'community.h', label: 'Heading', type: 'text', bilingual: true, emphasis: true },
      { path: 'community.p1', label: 'Intro paragraph 1', type: 'textarea', bilingual: true },
      { path: 'community.p2', label: 'Intro paragraph 2', type: 'textarea', bilingual: true },
      { path: 'community.pts.0.title', label: 'Card 1 · title', type: 'text', bilingual: true },
      { path: 'community.pts.0.body', label: 'Card 1 · body', type: 'textarea', bilingual: true },
      { path: 'community.pts.1.title', label: 'Card 2 · title', type: 'text', bilingual: true },
      { path: 'community.pts.1.body', label: 'Card 2 · body', type: 'textarea', bilingual: true },
      { path: 'community.pts.2.title', label: 'Card 3 · title', type: 'text', bilingual: true },
      { path: 'community.pts.2.body', label: 'Card 3 · body', type: 'textarea', bilingual: true },
    ],
  },
  {
    key: 'story',
    label: 'Story',
    fields: [
      { path: 'story.tag', label: 'Section tag', type: 'text', bilingual: true },
      { path: 'story.label', label: 'Photo caption', type: 'text', bilingual: true },
      { path: 'story.h', label: 'Heading', type: 'text', bilingual: true, emphasis: true },
      { path: 'story.p1', label: 'Paragraph 1', type: 'textarea', bilingual: true },
      { path: 'story.p2', label: 'Paragraph 2', type: 'textarea', bilingual: true },
      { path: 'story.p3', label: 'Paragraph 3', type: 'textarea', bilingual: true },
      { path: 'story.p4', label: 'Paragraph 4', type: 'textarea', bilingual: true },
      { path: 'story.closing', label: 'Closing line', type: 'textarea', bilingual: true },
      { path: 'story.sig', label: 'Signature', type: 'text', bilingual: true },
    ],
  },
  {
    key: 'pricing',
    label: 'Pricing',
    fields: [
      { path: 'pricing.tag', label: 'Section tag', type: 'text', bilingual: true },
      { path: 'pricing.h', label: 'Heading', type: 'text', bilingual: true, emphasis: true },
      { path: 'pricing.sub', label: 'Subheading', type: 'textarea', bilingual: true },
      { path: 'pricing.perMonth', label: '"per month" label', type: 'text', bilingual: true },
      { path: 'pricing.popular', label: '"Most popular" badge', type: 'text', bilingual: true },
      { path: 'pricing.btn', label: 'Button label', type: 'text', bilingual: true },
      { path: 'pricing.plans.0.name', label: 'Plan 1 · name', type: 'text', bilingual: true },
      { path: 'pricing.plans.0.price', label: 'Plan 1 · price', type: 'text', bilingual: false },
      { path: 'pricing.plans.0.items', label: 'Plan 1 · features (one per line)', type: 'list', bilingual: true },
      { path: 'pricing.plans.1.name', label: 'Plan 2 · name', type: 'text', bilingual: true },
      { path: 'pricing.plans.1.price', label: 'Plan 2 · price', type: 'text', bilingual: false },
      { path: 'pricing.plans.1.items', label: 'Plan 2 · features (one per line)', type: 'list', bilingual: true },
    ],
  },
  {
    key: 'finalCta',
    label: 'Final Call-to-Action',
    fields: [
      { path: 'finalCta.eyebrow', label: 'Eyebrow (small label)', type: 'text', bilingual: true },
      { path: 'finalCta.h', label: 'Heading', type: 'textarea', bilingual: true, emphasis: true },
      { path: 'finalCta.p', label: 'Paragraph', type: 'textarea', bilingual: true },
      { path: 'finalCta.btn', label: 'Button label', type: 'text', bilingual: true },
    ],
  },
  {
    key: 'nav',
    label: 'Navigation',
    fields: [
      { path: 'nav.join', label: '"Join" button label', type: 'text', bilingual: true },
    ],
  },
]

// Resolve a field + active language to the concrete content path.
export function resolvePath(field, lang) {
  if (!field.bilingual) return field.path
  return field.path + (lang === 'hy' ? 'Hy' : 'En')
}
