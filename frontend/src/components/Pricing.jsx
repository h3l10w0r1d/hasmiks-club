import { Link } from 'react-router-dom'
import t from '../data/content'

export default function Pricing({ lang }) {
  const c = t.pricing
  const hy = lang === 'hy'
  return (
    <section className="pricing" id="pricing">
      <div className="sec-tag" style={{ justifyContent: 'center' }}>
        {hy ? c.tagHy : c.tagEn}
      </div>
      <h2 className="sec-h" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto 12px' }}>
        {hy
          ? <>Մեկ անդամակցություն։ <em>Ամեն ինչ ներառված է։</em></>
          : <>One membership. <em>Everything included.</em></>
        }
      </h2>
      <p className="pricing-sub">{c.subEn}</p>

      <div className="plans">
        <div className="plan hero-plan">
          <div className="plan-name">
            {hy ? c.planNameHy : c.planNameEn}
          </div>
          <div className="plan-price"><sup>֏</sup>40,000</div>
          <div className="plan-mo">
            {hy ? c.perMonthHy : c.perMonthEn}
          </div>
          <div className="plan-hero-div"></div>
          <ul className="plan-list">
            {c.items.map((item, i) => (
              <li key={i}>{hy ? item.hy : item.en}</li>
            ))}
          </ul>
          <Link to="/register" className="plan-btn plan-btn-fill">
            {hy ? c.btnHy : c.btnEn}
          </Link>
        </div>
      </div>

      <p className="plan-note">
        {hy ? c.noteHy : c.noteEn}
      </p>
    </section>
  )
}
