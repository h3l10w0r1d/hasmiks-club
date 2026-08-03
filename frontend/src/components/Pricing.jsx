import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Star, Crown, Check } from 'lucide-react'
import { useContent } from '../context/SiteContentContext'
import { E, AddItemButton, RemoveItemButton } from './Editable'
import { getPublicPackages } from '../api/packages'
import Reveal from './Reveal'

const copy = {
  en: {
    perEvent: (n) => `֏${n.toLocaleString()} / event`,
    savings: (n) => `Savings: ֏${n.toLocaleString()}`,
    neverExpires: 'No expiry',
    validMonths: (n) => `Valid for ${n} month${n === 1 ? '' : 's'}`,
    validDays: (n) => `Valid for ${n} day${n === 1 ? '' : 's'}`,
    telegramIncluded: 'Access to the private Telegram club',
    popular: 'Most popular',
    bestValue: 'Best value',
  },
  hy: {
    perEvent: (n) => `֏${n.toLocaleString()} / միջոցառում`,
    savings: (n) => `Խնայողություն՝ ֏${n.toLocaleString()}`,
    neverExpires: 'Ժամկետ չունի',
    validMonths: (n) => `Գործում է ${n} ամիս`,
    validDays: (n) => `Գործում է ${n} օր`,
    telegramIncluded: 'Փակ Telegram ակումբի հասանելիություն',
    popular: 'Ամենապահանջված',
    bestValue: 'Ամենաշահեկ',
  },
}

export default function Pricing({ lang }) {
  const t = useContent()
  const c = t.pricing
  const hy = lang === 'hy'
  const tr = copy[lang] ?? copy.en
  const suffix = hy ? 'Hy' : 'En'
  const p = (b) => `pricing.${b}${suffix}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])
  const paragraphs = Array.isArray(v('sub')) ? v('sub') : [v('sub')].filter(Boolean)

  const [packages, setPackages] = useState([])

  useEffect(() => {
    getPublicPackages().then(setPackages).catch(() => setPackages([]))
  }, [])

  const basePerEvent = packages.find((pkg) => pkg.eventCount === 1)?.price ?? null

  return (
    <section className="pricing" id="pricing">
      <Reveal as="div">
        <E as="div" className="sec-tag" style={{ justifyContent: 'center' }} path={p('tag')} value={v('tag')} />
        <E as="h2" className="sec-h" style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto 12px' }} path={p('h')} value={v('h')} emphasis />
        {paragraphs.map((text, i) => (
          <div className="hc-item-row" key={i}>
            <E as="p" className="pricing-sub" path={p('sub')} value={text} listIndex={i} emphasis />
            {paragraphs.length > 1 && <RemoveItemButton paths={[p('sub')]} index={i} />}
          </div>
        ))}
        <AddItemButton paths={[p('sub')]} label={hy ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />
      </Reveal>

      <div className="plans">
        {packages.map((pkg, pos) => {
          const perEvent = pkg.eventCount > 0 ? Math.round(pkg.price / pkg.eventCount) : pkg.price
          const savings = basePerEvent != null && pkg.eventCount > 1 ? basePerEvent * pkg.eventCount - pkg.price : 0
          const items = hy ? pkg.itemsHy : pkg.itemsEn
          return (
            <Reveal as="div" className={`plan${pkg.badge ? ' hero-plan' : ''}`} key={pkg.id} delay={120 + pos * 90}>
              {pkg.badge && (
                <div className="plan-badge">
                  {pkg.badge === 'popular' ? <Star size={13} /> : <Crown size={13} />}
                  {pkg.badge === 'popular' ? tr.popular : tr.bestValue}
                </div>
              )}
              <div className="plan-name">{hy ? pkg.nameHy : pkg.nameEn}</div>
              <div className="plan-price"><sup>֏</sup>{Number(pkg.price).toLocaleString()}</div>
              <div className="plan-mo">{pkg.eventCount} {hy ? 'մասնակցություն' : `event${pkg.eventCount === 1 ? '' : 's'}`}</div>
              {pkg.eventCount > 1 && <div className="plan-per-event">{tr.perEvent(perEvent)}</div>}
              <div className="plan-hero-div"></div>
              <ul className="plan-list">
                {items.map((item, j) => (
                  <li key={j}><Check size={14} />{item}</li>
                ))}
                {pkg.telegramAccess && <li><Check size={14} />{tr.telegramIncluded}</li>}
                {savings > 0 && <li><Check size={14} />{tr.savings(savings)}</li>}
              </ul>
              <div className="plan-validity">
                {pkg.validityDays == null
                  ? tr.neverExpires
                  : pkg.validityDays % 30 === 0
                    ? tr.validMonths(pkg.validityDays / 30)
                    : tr.validDays(pkg.validityDays)}
              </div>
              <Link to="/register" className={`plan-btn ${pkg.badge ? 'plan-btn-fill' : 'plan-btn-outline'}`}>
                {v('btn')}
              </Link>
            </Reveal>
          )
        })}
      </div>

      <Reveal as="div" className="pricing-gift-teaser" style={{ textAlign: 'center', marginTop: 32 }}>
        <E as="p" className="pricing-sub" path={p('giftTeaser')} value={v('giftTeaser')} emphasis />
        <Link to="/gift" className="plan-btn-outline" style={{ display: 'inline-block', marginTop: 10, padding: '10px 22px', borderRadius: 999 }}>
          <E as="span" path={p('giftLink')} value={v('giftLink')} />
        </Link>
      </Reveal>
    </section>
  )
}
