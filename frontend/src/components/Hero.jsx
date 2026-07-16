import { Link } from 'react-router-dom'
import { heroImg } from '../data/images'
import t from '../data/content'

export default function Hero({ lang }) {
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
          {hy
            ? <>Միացիր մի ջերմ ակումբի, որտեղ քեզ <em>հասկանում են, ընդունում են և սպասում։</em></>
            : <>A club of <em>Armenian women</em> — meeting, sharing, belonging.</>
          }
        </h1>

        <p className="hero-p">
          {hy
            ? c.pHy
            : <>For the first time, Armenian women have a place built just for them — for women who are <strong>curious, alive, and refuse to disappear.</strong> A real club gathering face to face every two weeks and staying close on Telegram every day.</>
          }
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
