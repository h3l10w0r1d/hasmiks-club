import { Link } from 'react-router-dom'
import { useContent } from '../context/SiteContentContext'
import RichText from './RichText'
import Reveal from './Reveal'

export default function FinalCta({ lang }) {
  const t = useContent()
  const c = t.finalCta
  const hy = lang === 'hy'
  return (
    <section className="final final--cream">
      <Reveal as="div" className="final-content">
        <p className="final-eyebrow">
          {hy ? c.eyebrowHy : c.eyebrowEn}
        </p>
        <h2 className="final-h">
          <RichText text={hy ? c.hHy : c.hEn} />
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
