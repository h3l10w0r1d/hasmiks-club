import { Link } from 'react-router-dom'
import t from '../data/content'
import Reveal from './Reveal'

export default function FinalCta({ lang }) {
  const c = t.finalCta
  const hy = lang === 'hy'
  return (
    <section className="final final--cream">
      <Reveal as="div" className="final-content">
        <p className="final-eyebrow">
          {hy ? c.eyebrowHy : c.eyebrowEn}
        </p>
        <h2 className="final-h">
          {hy
            ? <>Գեղեցիկ օրերը <em>դեռ շատ են</em>։<br />Եկեք դրանք միասին ապրենք։</>
            : <>Beautiful days are <em>still ahead</em>.<br />Let us live them together.</>
          }
        </h2>
        <p className="final-p">
          {hy ? c.pHy : c.pEn}
        </p>
        <Link to="/register" className="btn-rose">
          {hy ? c.btnHy : c.btnEn}
        </Link>
      </Reveal>
    </section>
  )
}
