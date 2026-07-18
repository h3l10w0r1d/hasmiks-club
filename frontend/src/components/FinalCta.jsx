import { Link } from 'react-router-dom'
import { useContent } from '../context/SiteContentContext'
import { E } from './Editable'
import Reveal from './Reveal'

export default function FinalCta({ lang }) {
  const t = useContent()
  const c = t.finalCta
  const hy = lang === 'hy'
  const p = (b) => `finalCta.${b}${hy ? 'Hy' : 'En'}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])

  return (
    <section className="final final--cream">
      <Reveal as="div" className="final-content">
        <E as="p" className="final-eyebrow" path={p('eyebrow')} value={v('eyebrow')} />
        <E as="h2" className="final-h" path={p('h')} value={v('h')} emphasis />
        <E as="p" className="final-p" path={p('p')} value={v('p')} />
        <Link to="/register" className="btn-rose"><E as="span" path={p('btn')} value={v('btn')} /></Link>
      </Reveal>
    </section>
  )
}
