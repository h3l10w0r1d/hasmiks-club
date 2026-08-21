import { Leaf, Palette, Wine, Drama, Lightbulb, Bus } from 'lucide-react'
import { useContent } from '../context/SiteContentContext'
import { E, IS_EDIT, AddItemButton, RemoveItemButton } from './Editable'
import CardFrame from './CardFrame'
import { visibleOrder, fullOrder } from '../utils/cardOrder'
import Reveal from './Reveal'

// Keyed by the `ico` string on each content.offerings.cats entry — same
// indirection community.pts uses, so the icon is part of editable content
// rather than hardcoded per position, and reordering cards keeps its icon.
const OFFERING_ICONS = { leaf: Leaf, palette: Palette, wine: Wine, drama: Drama, lightbulb: Lightbulb, bus: Bus }

export default function Offerings({ lang }) {
  const t = useContent()
  const c = t.offerings
  const hy = lang === 'hy'
  const suffix = hy ? 'Hy' : 'En'
  const p = (b) => `offerings.${b}${suffix}`
  const v = (b) => c[`${b}${suffix}`]
  const cats = Array.isArray(c.cats) ? c.cats : []
  const catCount = cats.length
  // Edit mode shows every card (hidden ones dimmed) so a hidden one stays
  // reachable to un-hide; the public site only renders visible ones.
  const order = IS_EDIT ? fullOrder(c.__catsOrder, catCount) : visibleOrder(c.__catsOrder, c.__catsHidden, catCount)
  const visSet = IS_EDIT ? visibleOrder(c.__catsOrder, c.__catsHidden, catCount) : null

  return (
    <section className="offerings">
      <Reveal as="div" className="offerings-hd">
        <E as="div" className="sec-tag" style={{ justifyContent: 'center' }} path={p('tag')} value={v('tag')} />
        <E as="h2" className="sec-h" style={{ textAlign: 'center' }} path={p('h')} value={v('h')} emphasis />
        <E as="p" className="offerings-sub" path={p('sub')} value={v('sub')} emphasis />
      </Reveal>

      <div className="offerings-grid">
        {order.map((i, pos) => {
          const cat = cats[i]
          if (!cat) return null
          const Icon = OFFERING_ICONS[cat.ico] || Leaf
          const items = Array.isArray(cat[`items${suffix}`]) ? cat[`items${suffix}`] : []
          const itemsPath = `offerings.cats.${i}.items${suffix}`
          const isHidden = visSet && !visSet.includes(i)
          const card = (
            <Reveal as="div" className="offering-card" key={i} delay={pos * 70}>
              <div className="offering-card-hd">
                <span className="offering-ico"><Icon size={18} strokeWidth={1.75} /></span>
                <E as="div" className="offering-title" path={`offerings.cats.${i}.title${suffix}`} value={cat[`title${suffix}`]} />
              </div>
              <div className="offering-items">
                {items.map((text, j) => (
                  <div className="hc-item-row" key={j}>
                    <E as="div" className="offering-item" path={itemsPath} value={text} listIndex={j} />
                    {items.length > 1 && <RemoveItemButton paths={[itemsPath]} index={j} />}
                  </div>
                ))}
              </div>
              <AddItemButton paths={[itemsPath]} label={hy ? 'Ավելացնել տող' : 'Add item'} />
            </Reveal>
          )
          if (!IS_EDIT) return card
          return (
            <CardFrame key={i} orderPath="offerings.__catsOrder" hiddenPath="offerings.__catsHidden" itemCount={catCount}
              index={i} canLeft={order.indexOf(i) > 0} canRight={order.indexOf(i) < order.length - 1} dimmed={isHidden}>
              {card}
            </CardFrame>
          )
        })}
      </div>
    </section>
  )
}
