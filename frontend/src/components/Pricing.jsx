import { Link } from 'react-router-dom'
import t from '../data/content'
import Reveal from './Reveal'

export default function Pricing({ lang }) {
  const c = t.pricing
  const hy = lang === 'hy'
  return (
    <section className="pricing" id="pricing">
      <Reveal as="div">
        <div className="sec-tag" style={{ justifyContent: 'center' }}>
          {hy ? c.tagHy : c.tagEn}
        </div>
        <h2 className="sec-h" style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto 12px' }}>
          {hy
            ? <>Ակումբի ամսական <em>անդամակցություն</em></>
            : <>Club monthly <em>membership</em></>
          }
        </h2>
        <p className="pricing-sub">{hy ? c.subHy : c.subEn}</p>
      </Reveal>

      <div className="plans">
        {c.plans.map((plan, i) => (
          <Reveal as="div" className={`plan${plan.popular ? ' hero-plan' : ''}`} key={i} delay={120 + i * 90}>
            {plan.popular && (
              <div className="plan-badge">{hy ? c.popularHy : c.popularEn}</div>
            )}
            <div className="plan-name">
              {hy ? plan.nameHy : plan.nameEn}
            </div>
            <div className="plan-price"><sup>֏</sup>{plan.price}</div>
            <div className="plan-mo">
              {hy ? c.perMonthHy : c.perMonthEn}
            </div>
            <div className="plan-hero-div"></div>
            <ul className="plan-list">
              {(hy ? plan.itemsHy : plan.itemsEn).map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
            <Link to="/register" className={`plan-btn ${plan.popular ? 'plan-btn-fill' : 'plan-btn-outline'}`}>
              {hy ? c.btnHy : c.btnEn}
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
