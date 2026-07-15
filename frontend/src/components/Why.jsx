import { Handshake, MessageCircle, Flower2 } from 'lucide-react'
import { whyImg } from '../data/images'
import t from '../data/content'
import Reveal from './Reveal'

const PT_ICONS = { handshake: Handshake, chat: MessageCircle, flower: Flower2 }

export default function Why({ lang }) {
  const c = t.why
  const hy = lang === 'hy'
  return (
    <section className="why">
      <Reveal as="div" className="why-text-col">
        <div className="sec-tag">{hy ? c.tagHy : c.tagEn}</div>
        <h2 className="sec-h">
          {hy
            ? <>Ինչ կստանաք <em>ակումբում</em>։</>
            : <>What you get in <em>the club</em>.</>
          }
        </h2>
        <p className="sec-p">
          {hy ? c.p1Hy : c.p1En}
        </p>
        <p className="sec-p">
          {hy ? c.p2Hy : c.p2En}
        </p>

        <div className="pts">
          {c.pts.map((pt, i) => {
            const Icon = PT_ICONS[pt.ico]
            return (
            <Reveal as="div" className="pt" key={i} delay={i * 90}>
              <div className="pt-ico"><Icon size={17} strokeWidth={1.75} /></div>
              <div>
                <div className="pt-title">{hy ? pt.titleHy : pt.titleEn}</div>
                <div className="pt-body">{hy ? pt.bodyHy : pt.bodyEn}</div>
              </div>
            </Reveal>
            )
          })}
        </div>
      </Reveal>

      <Reveal as="div" className="why-img-col" delay={120}>
        <img src={whyImg} alt="Hasmik with flowers" />
        <div className="why-quote">
          <p className="why-quote-t">{hy ? c.quoteHy : c.quoteEn}</p>
          <cite className="why-quote-c">— Հասմիկ</cite>
        </div>
      </Reveal>
    </section>
  )
}
