import { Link } from 'react-router-dom'
import { heroImg } from '../data/images'
import { useContent } from '../context/SiteContentContext'
import { E, EditableImage, EditableLinkHref, isExternalHref, AddItemButton, RemoveItemButton } from './Editable'

export default function Hero({ lang }) {
  const t = useContent()
  const c = t.hero
  const hy = lang === 'hy'
  const p = (b) => `hero.${b}${hy ? 'Hy' : 'En'}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])
  const joinHref = c.joinHref || '/register'
  // Legacy sites may still have a published override that set this as a
  // plain string before it became a growable list — normalize either way.
  const paragraphs = Array.isArray(v('p')) ? v('p') : [v('p')].filter(Boolean)

  return (
    <section className="hero">
      <div className="hero-img-side">
        <EditableImage src={c.image || heroImg} alt="Hasmik" path="hero.image" />
        <div className="hero-img-overlay"></div>
        <E as="div" className="hero-img-pill" path={p('pill')} value={v('pill')} />
      </div>

      <div className="hero-text-side">
        <div className="eyebrow">
          <div className="eyebrow-line"></div>
          <E as="span" className="eyebrow-text" path={p('eyebrow')} value={v('eyebrow')} />
        </div>

        <E as="h1" className="hero-h1" path={p('h1')} value={v('h1')} emphasis />
        {paragraphs.map((text, i) => (
          <div className="hc-item-row" key={i}>
            <E as="p" className="hero-p" path={p('p')} value={text} listIndex={i} emphasis />
            {paragraphs.length > 1 && <RemoveItemButton paths={[p('p')]} index={i} />}
          </div>
        ))}
        <AddItemButton paths={[p('p')]} label={hy ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />

        <EditableLinkHref path="hero.joinHref" value={joinHref}>
          {isExternalHref(joinHref)
            ? <a href={joinHref} target="_blank" rel="noopener noreferrer" className="btn-rose"><E as="span" path={p('join')} value={v('join')} /></a>
            : <Link to={joinHref} className="btn-rose"><E as="span" path={p('join')} value={v('join')} /></Link>}
        </EditableLinkHref>

        <div className="hero-stats">
          <div className="hstat"><div className="hstat-n">40K</div><E as="div" className="hstat-l" path={p('stat1Label')} value={v('stat1Label')} /></div>
          <div className="hstat"><div className="hstat-n">2</div><E as="div" className="hstat-l" path={p('stat2Label')} value={v('stat2Label')} /></div>
          <div className="hstat"><div className="hstat-n">#1</div><E as="div" className="hstat-l" path={p('stat3Label')} value={v('stat3Label')} /></div>
        </div>
      </div>
    </section>
  )
}
