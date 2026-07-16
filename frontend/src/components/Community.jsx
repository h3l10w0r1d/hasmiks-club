import { Handshake, MessageCircle, Flower2 } from 'lucide-react'
import communityImg from '../assets/community.jpg'
import t from '../data/content'
import Reveal from './Reveal'

const PT_ICONS = { handshake: Handshake, chat: MessageCircle, flower: Flower2 }

export default function Community({ lang }) {
  const c = t.community
  const hy = lang === 'hy'
  return (
    <section className="community">
      <Reveal as="div" className="community-hd">
        <div className="sec-tag" style={{ justifyContent: 'center' }}>
          {hy ? c.tagHy : c.tagEn}
        </div>
        <h2 className="sec-h" style={{ textAlign: 'center' }}>
          {hy
            ? <>Ինչ կստանաք <em>ակումբում</em>։</>
            : <>What you get in <em>the club</em>.</>
          }
        </h2>
        <p className="community-sub">{hy ? c.p1Hy : c.p1En}</p>
        <p className="community-sub">{hy ? c.p2Hy : c.p2En}</p>
      </Reveal>

      <div className="cards community-cards">
        {c.pts.map((pt, i) => {
          const Icon = PT_ICONS[pt.ico]
          return (
            <Reveal as="div" className="card" key={i} delay={i * 90}>
              <div className="card-ico"><Icon size={20} strokeWidth={1.75} /></div>
              <div className="card-title">{hy ? pt.titleHy : pt.titleEn}</div>
              <p className="card-text">{hy ? pt.bodyHy : pt.bodyEn}</p>
            </Reveal>
          )
        })}
      </div>

      <Reveal as="div" className="community-photo" delay={80}>
        <img src={communityImg}
          alt={hy ? "Hasmik's Club-ի անդամները միասին" : "Members of Hasmik's Club together"} />
      </Reveal>
    </section>
  )
}
