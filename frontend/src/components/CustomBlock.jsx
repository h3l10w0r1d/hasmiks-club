import { useContent } from '../context/SiteContentContext'
import { E, EditableImage, AddItemButton, RemoveItemButton, IS_EDIT } from './Editable'
import { BLOCK_SEED } from '../data/landingSections'
import Reveal from './Reveal'

// Renders a freshly-added block (via the editor's Add Block > new block
// templates), fully editable. Its content lives at content overrides
// "custom.<id>.*" (a plain nested key, same mechanism as everything else) and
// is seeded with real starting values at creation time (see BLOCK_SEED) — the
// fallbacks below only matter for a block whose seed is somehow missing.
// Repeatable content (paragraphs, FAQ rows, stat pairs) is stored as parallel
// string arrays and grown/shrunk via AddItemButton/RemoveItemButton.

function seedFor(type) {
  return BLOCK_SEED[type] || BLOCK_SEED.text
}

function useBlockFields(id, lang) {
  const t = useContent()
  const cb = (t.custom && t.custom[id]) || {}
  const hy = lang === 'hy'
  const sfx = hy ? 'Hy' : 'En'
  const path = (base) => `custom.${id}.${base}${sfx}`
  return { cb, hy, sfx, path }
}

function Paragraphs({ id, sfx, path, items, seed }) {
  const list = items && items.length ? items : seed[`items${sfx}`]
  return (
    <>
      {list.map((text, i) => (
        <div className="hc-item-row" key={i}>
          <E as="p" className="story-body" path={path('items')} value={text} listIndex={i} />
          {items && items.length > 1 && <RemoveItemButton paths={[path('items')]} index={i} />}
        </div>
      ))}
      <AddItemButton paths={[path('items')]} label={sfx === 'Hy' ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />
    </>
  )
}

export default function CustomBlock({ id, type, lang }) {
  const { cb, hy, sfx, path } = useBlockFields(id, lang)
  const seed = seedFor(type)
  const heading = cb[`heading${sfx}`] ?? seed[`heading${sfx}`]

  if (type === 'imageText') {
    const image = cb.image || ''
    return (
      <section className="story">
        {(image || IS_EDIT) && (
          <Reveal as="div" className="story-img">
            <EditableImage src={image} alt="" path={`custom.${id}.image`} />
          </Reveal>
        )}
        <Reveal as="div" className="story-text-col" delay={120}>
          <E as="h2" className="story-h" path={path('heading')} value={heading} />
          <Paragraphs id={id} sfx={sfx} path={path} items={cb[`items${sfx}`]} seed={seed} />
        </Reveal>
      </section>
    )
  }

  if (type === 'testimonial') {
    const photo = cb.photo || ''
    return (
      <section className="pricing">
        <Reveal as="div" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          {(photo || IS_EDIT) && (
            <div style={{ marginBottom: 16 }}>
              <EditableImage src={photo} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', margin: '0 auto' }} path={`custom.${id}.photo`} />
            </div>
          )}
          <E as="p" className="story-lead" path={path('quote')} value={cb[`quote${sfx}`] ?? seed[`quote${sfx}`]} />
          <E as="div" className="story-sig" path={path('name')} value={cb[`name${sfx}`] ?? seed[`name${sfx}`]} />
        </Reveal>
      </section>
    )
  }

  if (type === 'stats') {
    const numbers = cb[`numbers${sfx}`]?.length ? cb[`numbers${sfx}`] : seed[`numbers${sfx}`]
    const labels = cb[`statLabels${sfx}`]?.length ? cb[`statLabels${sfx}`] : seed[`statLabels${sfx}`]
    return (
      <section className="pricing">
        <Reveal as="div" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <E as="h2" className="sec-h" style={{ textAlign: 'center' }} path={path('heading')} value={heading} />
          <div className="hero-stats" style={{ justifyContent: 'center', margin: '24px auto 0' }}>
            {numbers.map((num, i) => (
              <div className="hstat hc-item-row" key={i}>
                <E as="div" className="hstat-n" path={path('numbers')} value={num} listIndex={i} />
                <E as="div" className="hstat-l" path={path('statLabels')} value={labels[i] ?? ''} listIndex={i} />
                {numbers.length > 1 && <RemoveItemButton paths={[path('numbers'), path('statLabels')]} index={i} />}
              </div>
            ))}
          </div>
          <AddItemButton paths={[path('numbers'), path('statLabels')]} label={hy ? 'Ավելացնել ցուցանիշ' : 'Add stat'} />
        </Reveal>
      </section>
    )
  }

  if (type === 'faq') {
    const questions = cb[`questions${sfx}`]?.length ? cb[`questions${sfx}`] : seed[`questions${sfx}`]
    const answers = cb[`answers${sfx}`]?.length ? cb[`answers${sfx}`] : seed[`answers${sfx}`]
    return (
      <section className="pricing">
        <Reveal as="div" style={{ maxWidth: 720, margin: '0 auto' }}>
          <E as="h2" className="sec-h" style={{ textAlign: 'center' }} path={path('heading')} value={heading} />
          <div style={{ marginTop: 24, textAlign: 'left' }}>
            {questions.map((q, i) => (
              <div className="hc-item-row faq-item" key={i}>
                <E as="div" className="faq-q" path={path('questions')} value={q} listIndex={i} />
                <E as="p" className="faq-a" path={path('answers')} value={answers[i] ?? ''} listIndex={i} />
                {questions.length > 1 && <RemoveItemButton paths={[path('questions'), path('answers')]} index={i} />}
              </div>
            ))}
          </div>
          <AddItemButton paths={[path('questions'), path('answers')]} label={hy ? 'Ավելացնել հարց' : 'Add question'} />
        </Reveal>
      </section>
    )
  }

  // default: plain text block
  return (
    <section className="pricing">
      <Reveal as="div" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <E as="h2" className="sec-h" style={{ textAlign: 'center' }} path={path('heading')} value={heading} />
        <Paragraphs id={id} sfx={sfx} path={path} items={cb[`items${sfx}`]} seed={seed} />
      </Reveal>
    </section>
  )
}
