import { heroImg } from '../data/images'
import t from '../data/content'

export default function FinalCta({ lang }) {
  const c = t.finalCta
  const hy = lang === 'hy'
  return (
    <section className="final">
      <div className="final-bg">
        <img src={heroImg} alt="Hasmik" />
      </div>
      <div className="final-content">
        <p className="final-eyebrow">
          {hy ? c.eyebrowHy : c.eyebrowEn}
        </p>
        <h2 className="final-h">
          {hy
            ? <>Ayн kanayk, um <em>p&apos;ntrum eir</em>, ardyen aystеgh en.</>
            : <>The women you have been <em>looking for</em> are already here.</>
          }
        </h2>
        <p className="final-p">
          {hy ? c.pHy : c.pEn}
        </p>
        <a href="#pricing" className="btn-cream">
          {hy ? c.btnHy : c.btnEn}
        </a>
        <p className="final-tiny">
          {hy ? c.tinyHy : c.tinyEn}
        </p>
      </div>
    </section>
  )
}
