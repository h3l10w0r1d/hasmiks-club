import { storyImg } from '../data/images'
import t from '../data/content'
import Reveal from './Reveal'

export default function Story({ lang }) {
  const c = t.story
  const hy = lang === 'hy'
  return (
    <section className="story">
      <Reveal as="div" className="story-img">
        <img src={storyImg} alt="Hasmik outside" />
        <div className="story-label">
          {hy ? c.labelHy : c.labelEn}
        </div>
      </Reveal>

      <Reveal as="div" className="story-text-col" delay={120}>
        <div className="sec-tag">{hy ? c.tagHy : c.tagEn}</div>
        <h2 className="story-h">
          {hy
            ? <>72-ում կյանքը <em>չի ավարտվում</em>։<br />Այն կարող է նորից սկսվել։</>
            : <>Life at 72 does not <em>end</em>.<br />It can begin again.</>
          }
        </h2>
        <p className="story-body">
          {hy ? c.p1Hy : c.p1En}
        </p>
        <p className="story-body">
          {hy ? c.p2Hy : c.p2En}
        </p>
        <p className="story-body">
          {hy ? c.p3Hy : c.p3En}
        </p>
        <p className="story-body">
          {hy ? c.p4Hy : c.p4En}
        </p>
        <div className="story-sig">
          {hy ? c.sigHy : c.sigEn}
        </div>
      </Reveal>
    </section>
  )
}
