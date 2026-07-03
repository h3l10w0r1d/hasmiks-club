import { Link } from 'react-router-dom'
import { heroImg } from '../data/images'
import t from '../data/content'
import Reveal from './Reveal'

export default function FinalCta({ lang }) {
  const c = t.finalCta
  const hy = lang === 'hy'
  return (
    <section className="final">
      <div className="final-bg">
        <img src={heroImg} alt="Hasmik" />
      </div>
      <Reveal as="div" className="final-content">
        <p className="final-eyebrow">
          {hy ? c.eyebrowHy : c.eyebrowEn}
        </p>
        <h2 className="final-h">
          {hy
            ? <>Այն կանայք, ում <em>փնտրում էիր</em>, արդեն այստեղ են։</>
            : <>The women you have been <em>looking for</em> are already here.</>
          }
        </h2>
        <p className="final-p">
          {hy ? c.pHy : c.pEn}
        </p>
        <Link to="/register" className="btn-cream">
          {hy ? c.btnHy : c.btnEn}
        </Link>
        <p className="final-tiny">
          {hy ? c.tinyHy : c.tinyEn}
        </p>
      </Reveal>
    </section>
  )
}
