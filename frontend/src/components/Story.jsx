import { storyImg } from '../data/images'
import t from '../data/content'

export default function Story({ lang }) {
  const c = t.story
  const hy = lang === 'hy'
  return (
    <section className="story">
      <div className="story-img">
        <img src={storyImg} alt="Hasmik outside" />
        <div className="story-label">
          {hy ? c.labelHy : c.labelEn}
        </div>
      </div>

      <div className="story-text-col">
        <div className="sec-tag">{hy ? c.tagHy : c.tagEn}</div>
        <h2 className="story-h">
          {hy
            ? <>72-um kayinkhy <em>avart</em> che.<br />Sa skizb e.</>
            : <>Life at 72 is not an <em>ending</em>.<br />It is a beginning.</>
          }
        </h2>
        <p className="story-body">
          {hy
            ? c.p1Hy
            : <>I am going to say something Armenian society does not say enough: <strong>you do not have to disappear after a certain age.</strong> You do not have to shrink yourself, stop dreaming, or pretend life is mostly behind you. It is not.</>
          }
        </p>
        <p className="story-body">
          {hy ? c.p2Hy : c.p2En}
        </p>
        <p className="story-body">
          {hy
            ? c.p3Hy
            : <>That is what Hasmik&apos;s Club is. Not a support group. Not a nostalgia club. A community of Armenian women who are <strong>awake, present, and choosing themselves</strong> — women who take care of how they look, who want real friendships, who still get excited about a new place, a new idea, a good conversation over coffee.</>
          }
        </p>
        <p className="story-body">
          {hy ? c.p4Hy : c.p4En}
        </p>
        <div className="story-sig">
          {hy ? c.sigHy : c.sigEn}
        </div>
      </div>
    </section>
  )
}
