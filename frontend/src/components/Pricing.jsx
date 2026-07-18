import { Link } from 'react-router-dom'
import { useContent } from '../context/SiteContentContext'
import { E, IS_EDIT } from './Editable'
import CardFrame from './CardFrame'
import { visibleOrder, fullOrder } from '../utils/cardOrder'
import Reveal from './Reveal'

export default function Pricing({ lang }) {
  const t = useContent()
  const c = t.pricing
  const hy = lang === 'hy'
  const suffix = hy ? 'Hy' : 'En'
  const p = (b) => `pricing.${b}${suffix}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])
  const planCount = c.plans.length
  const order = IS_EDIT ? fullOrder(c.__plansOrder, planCount) : visibleOrder(c.__plansOrder, c.__plansHidden, planCount)
  const visSet = IS_EDIT ? visibleOrder(c.__plansOrder, c.__plansHidden, planCount) : null

  return (
    <section className="pricing" id="pricing">
      <Reveal as="div">
        <E as="div" className="sec-tag" style={{ justifyContent: 'center' }} path={p('tag')} value={v('tag')} />
        <E as="h2" className="sec-h" style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto 12px' }} path={p('h')} value={v('h')} emphasis />
        <E as="p" className="pricing-sub" path={p('sub')} value={v('sub')} />
      </Reveal>

      <div className="plans">
        {order.map((i, pos) => {
          const plan = c.plans[i]
          const isHidden = visSet && !visSet.includes(i)
          const planCard = (
            <Reveal as="div" className={`plan${plan.popular ? ' hero-plan' : ''}`} key={i} delay={120 + pos * 90}>
              {plan.popular && (
                <E as="div" className="plan-badge" path={p('popular')} value={v('popular')} />
              )}
              <E as="div" className="plan-name" path={`pricing.plans.${i}.name${suffix}`} value={hy ? plan.nameHy : plan.nameEn} />
              <div className="plan-price"><sup>֏</sup><E as="span" path={`pricing.plans.${i}.price`} value={plan.price} /></div>
              <E as="div" className="plan-mo" path={p('perMonth')} value={v('perMonth')} />
              <div className="plan-hero-div"></div>
              <ul className="plan-list">
                {(hy ? plan.itemsHy : plan.itemsEn).map((item, j) => (
                  <E as="li" key={j} path={`pricing.plans.${i}.items${suffix}`} value={item} listIndex={j} />
                ))}
              </ul>
              <Link to="/register" className={`plan-btn ${plan.popular ? 'plan-btn-fill' : 'plan-btn-outline'}`}>
                <E as="span" path={p('btn')} value={v('btn')} />
              </Link>
            </Reveal>
          )
          if (!IS_EDIT) return planCard
          return (
            <CardFrame key={i} orderPath="pricing.__plansOrder" hiddenPath="pricing.__plansHidden" itemCount={planCount}
              index={i} canLeft={order.indexOf(i) > 0} canRight={order.indexOf(i) < order.length - 1} dimmed={isHidden}>
              {planCard}
            </CardFrame>
          )
        })}
      </div>
    </section>
  )
}
