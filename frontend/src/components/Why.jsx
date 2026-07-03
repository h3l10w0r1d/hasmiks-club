import { whyImg } from '../data/images'
import t from '../data/content'
import Reveal from './Reveal'

export default function Why({ lang }) {
  const c = t.why
  const hy = lang === 'hy'
  return (
    <section className="why">
      <Reveal as="div" className="why-text-col">
        <div className="sec-tag">{hy ? c.tagHy : c.tagEn}</div>
        <h2 className="sec-h">
          {hy
            ? <>50+ հայ կանանց <em>համայնք</em>՝ ջերմության, շփման և պատկանելու շուրջ։</>
            : <>The <em>#1</em> Armenian Women&apos;s Community for women 50+.</>
          }
        </h2>
        <p className="sec-p">
          {hy
            ? c.p1Hy
            : <>Armenian women have always been the heart of the family — the keepers of tradition, the quiet strength behind everything. But we never had a space built just for <strong>us</strong>.</>
          }
        </p>
        <p className="sec-p">
          {hy ? c.p2Hy : c.p2En}
        </p>

        <div className="pts">
          {c.pts.map((pt, i) => (
            <Reveal as="div" className="pt" key={i} delay={i * 90}>
              <div className="pt-ico">{pt.ico}</div>
              <div>
                <div className="pt-title">{hy ? pt.titleHy : pt.titleEn}</div>
                <div className="pt-body">{hy ? pt.bodyHy : pt.bodyEn}</div>
              </div>
            </Reveal>
          ))}
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
