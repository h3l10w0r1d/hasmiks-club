import { Handshake, MessageCircle, Flower2 } from 'lucide-react'
import communityImg from '../assets/community.jpg'
import { useContent } from '../context/SiteContentContext'
import { E, EditableImage, IS_EDIT, AddItemButton, RemoveItemButton } from './Editable'
import CardFrame from './CardFrame'
import { visibleOrder, fullOrder } from '../utils/cardOrder'
import Reveal from './Reveal'

const PT_ICONS = { handshake: Handshake, chat: MessageCircle, flower: Flower2 }

export default function Community({ lang }) {
  const t = useContent()
  const c = t.community
  const hy = lang === 'hy'
  const p = (b) => `community.${b}${hy ? 'Hy' : 'En'}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])
  const ptCount = c.pts.length
  // Legacy sites may still have a published override that set these as plain
  // strings before they became growable lists — normalize either way.
  const paragraphs1 = Array.isArray(v('p1')) ? v('p1') : [v('p1')].filter(Boolean)
  const paragraphs2 = Array.isArray(v('p2')) ? v('p2') : [v('p2')].filter(Boolean)
  // Edit mode shows every card (hidden ones dimmed) in its current order so a
  // hidden card stays reachable to un-hide; the public site only shows visible ones.
  const order = IS_EDIT ? fullOrder(c.__ptsOrder, ptCount) : visibleOrder(c.__ptsOrder, c.__ptsHidden, ptCount)
  const visSet = IS_EDIT ? visibleOrder(c.__ptsOrder, c.__ptsHidden, ptCount) : null

  return (
    <section className="community">
      <Reveal as="div" className="community-hd">
        <E as="div" className="sec-tag" style={{ justifyContent: 'center' }} path={p('tag')} value={v('tag')} />
        <E as="h2" className="sec-h" style={{ textAlign: 'center' }} path={p('h')} value={v('h')} emphasis />
        {paragraphs1.map((text, i) => (
          <div className="hc-item-row" key={i}>
            <E as="p" className="community-sub" path={p('p1')} value={text} listIndex={i} emphasis />
            {paragraphs1.length > 1 && <RemoveItemButton paths={[p('p1')]} index={i} />}
          </div>
        ))}
        <AddItemButton paths={[p('p1')]} label={hy ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />
        {paragraphs2.map((text, i) => (
          <div className="hc-item-row" key={i}>
            <E as="p" className="community-sub" path={p('p2')} value={text} listIndex={i} emphasis />
            {paragraphs2.length > 1 && <RemoveItemButton paths={[p('p2')]} index={i} />}
          </div>
        ))}
        <AddItemButton paths={[p('p2')]} label={hy ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />
      </Reveal>

      <Reveal as="div" className="community-photo" delay={80}>
        <EditableImage src={c.image || communityImg}
          alt={hy ? "Hasmik's Club-ի անդամները միասին" : "Members of Hasmik's Club together"} path="community.image" />
      </Reveal>

      <div className="cards community-cards">
        {order.map((i, pos) => {
          const pt = c.pts[i]
          const Icon = PT_ICONS[pt.ico]
          const suffix = hy ? 'Hy' : 'En'
          const isHidden = visSet && !visSet.includes(i)
          const card = (
            <Reveal as="div" className="card" key={i} delay={pos * 90}>
              <div className="card-ico"><Icon size={20} strokeWidth={1.75} /></div>
              <E as="div" className="card-title" path={`community.pts.${i}.title${suffix}`} value={hy ? pt.titleHy : pt.titleEn} />
              <E as="p" className="card-text" path={`community.pts.${i}.body${suffix}`} value={hy ? pt.bodyHy : pt.bodyEn} emphasis />
            </Reveal>
          )
          if (!IS_EDIT) return card
          return (
            <CardFrame key={i} orderPath="community.__ptsOrder" hiddenPath="community.__ptsHidden" itemCount={ptCount}
              index={i} canLeft={order.indexOf(i) > 0} canRight={order.indexOf(i) < order.length - 1} dimmed={isHidden}>
              {card}
            </CardFrame>
          )
        })}
      </div>
    </section>
  )
}
