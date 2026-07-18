import { Link } from 'react-router-dom'
import { heroImg } from '../data/images'
import { useContent } from '../context/SiteContentContext'
import RichText from './RichText'

export default function Hero({ lang }) {
  const t = useContent()
  const c = t.hero
  const hy = lang === 'hy'
  return (
    <section className="hero">
      <div className="hero-img-side">
        <img src={heroImg} alt="Hasmik" />
        <div className="hero-img-overlay"></div>
        <div className="hero-img-pill">
          {hy ? c.pillHy : c.pillEn}
        </div>
      </div>

      <div className="hero-text-side">
        <div className="eyebrow">
          <div className="eyebrow-line"></div>
          <span className="eyebrow-text">
            {hy ? c.eyebrowHy : c.eyebrowEn}
          </span>
        </div>

        <h1 className="hero-h1">
          <RichText text={hy ? c.h1Hy : c.h1En} />
        </h1>

        <p className="hero-p">
          <RichText text={hy ? c.pHy : c.pEn} />
        </p>

        <Link to="/register" className="btn-rose">
          {hy ? c.joinHy : c.joinEn}
        </Link>

        <div className="hero-stats">
          <div className="hstat">
            <div className="hstat-n">40K</div>
            <div className="hstat-l">{hy ? c.stat1LabelHy : c.stat1LabelEn}</div>
          </div>
          <div className="hstat">
            <div className="hstat-n">2</div>
            <div className="hstat-l">{hy ? c.stat2LabelHy : c.stat2LabelEn}</div>
          </div>
          <div className="hstat">
            <div className="hstat-n">#1</div>
            <div className="hstat-l">{hy ? c.stat3LabelHy : c.stat3LabelEn}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
