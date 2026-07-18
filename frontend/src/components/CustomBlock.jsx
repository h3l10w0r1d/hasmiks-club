import { useContent } from '../context/SiteContentContext'
import { E, EditableImage, IS_EDIT } from './Editable'
import Reveal from './Reveal'

// Renders a freshly-added block (via the editor's Add Block > new block
// templates), fully editable, with no bundled default content — an admin adds
// one, then fills it in on the canvas. Its content lives at content overrides
// "custom.<id>.*" (a plain nested key, same mechanism as everything else).
const PLACEHOLDER = {
  headingEn: 'Add a heading', headingHy: 'Ավելացրեք վերնագիր',
  bodyEn: 'Write your text here…', bodyHy: 'Գրեք ձեր տեքստը այստեղ…',
}

export default function CustomBlock({ id, type, lang }) {
  const t = useContent()
  const cb = (t.custom && t.custom[id]) || {}
  const hy = lang === 'hy'
  const sfx = hy ? 'Hy' : 'En'
  const heading = cb[`heading${sfx}`] ?? PLACEHOLDER[`heading${sfx}`]
  const body = cb[`body${sfx}`] ?? PLACEHOLDER[`body${sfx}`]
  const image = cb.image || ''

  if (type === 'imageText') {
    return (
      <section className="story">
        {(image || IS_EDIT) && (
          <Reveal as="div" className="story-img">
            <EditableImage src={image} alt="" path={`custom.${id}.image`} />
          </Reveal>
        )}
        <Reveal as="div" className="story-text-col" delay={120}>
          <E as="h2" className="story-h" path={`custom.${id}.heading${sfx}`} value={heading} />
          <E as="p" className="story-body" path={`custom.${id}.body${sfx}`} value={body} />
        </Reveal>
      </section>
    )
  }

  return (
    <section className="pricing">
      <Reveal as="div" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <E as="h2" className="sec-h" style={{ textAlign: 'center' }} path={`custom.${id}.heading${sfx}`} value={heading} />
        <E as="p" className="pricing-sub" path={`custom.${id}.body${sfx}`} value={body} />
      </Reveal>
    </section>
  )
}
