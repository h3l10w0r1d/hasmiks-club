import { Link } from 'react-router-dom'
import { useContent } from '../context/SiteContentContext'
import { E, EditableLinkHref, isExternalHref, AddItemButton, RemoveItemButton } from './Editable'
import Reveal from './Reveal'

export default function FinalCta({ lang }) {
  const t = useContent()
  const c = t.finalCta
  const hy = lang === 'hy'
  const p = (b) => `finalCta.${b}${hy ? 'Hy' : 'En'}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])
  const btnHref = c.btnHref || '/register'
  // Legacy sites may still have a published override that set this as a
  // plain string before it became a growable list — normalize either way.
  const paragraphs = Array.isArray(v('p')) ? v('p') : [v('p')].filter(Boolean)

  return (
    <section className="final final--cream">
      <Reveal as="div" className="final-content">
        <E as="p" className="final-eyebrow" path={p('eyebrow')} value={v('eyebrow')} />
        <E as="h2" className="final-h" path={p('h')} value={v('h')} emphasis />
        {paragraphs.map((text, i) => (
          <div className="hc-item-row" key={i}>
            <E as="p" className="final-p" path={p('p')} value={text} listIndex={i} emphasis />
            {paragraphs.length > 1 && <RemoveItemButton paths={[p('p')]} index={i} />}
          </div>
        ))}
        <AddItemButton paths={[p('p')]} label={hy ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />
        <EditableLinkHref path="finalCta.btnHref" value={btnHref}>
          {isExternalHref(btnHref)
            ? <a href={btnHref} target="_blank" rel="noopener noreferrer" className="btn-rose"><E as="span" path={p('btn')} value={v('btn')} /></a>
            : <Link to={btnHref} className="btn-rose"><E as="span" path={p('btn')} value={v('btn')} /></Link>}
        </EditableLinkHref>
      </Reveal>
    </section>
  )
}
