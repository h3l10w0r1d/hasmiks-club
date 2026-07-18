import { storyImg } from '../data/images'
import { useContent } from '../context/SiteContentContext'
import { E, EditableImage } from './Editable'
import Reveal from './Reveal'

export default function Story({ lang }) {
  const t = useContent()
  const c = t.story
  const hy = lang === 'hy'
  const p = (b) => `story.${b}${hy ? 'Hy' : 'En'}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])

  return (
    <section className="story">
      <Reveal as="div" className="story-img">
        <EditableImage src={c.image || storyImg} alt="Hasmik outside" path="story.image" />
        <E as="div" className="story-label" path={p('label')} value={v('label')} />
      </Reveal>

      <Reveal as="div" className="story-text-col" delay={120}>
        <E as="div" className="sec-tag" path={p('tag')} value={v('tag')} />
        <E as="h2" className="story-h" path={p('h')} value={v('h')} emphasis />
        <E as="p" className="story-body" path={p('p1')} value={v('p1')} />
        <E as="p" className="story-body" path={p('p2')} value={v('p2')} />
        <E as="p" className="story-body" path={p('p3')} value={v('p3')} />
        <E as="p" className="story-body" path={p('p4')} value={v('p4')} />
        <E as="p" className="story-closing" path={p('closing')} value={v('closing')} />
        <E as="div" className="story-sig" path={p('sig')} value={v('sig')} />
      </Reveal>
    </section>
  )
}
