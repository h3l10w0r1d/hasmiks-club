import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Star, Crown, Check, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAuthModal } from '../context/AuthModalContext'
import { useContent } from '../context/SiteContentContext'
import { E, AddItemButton, RemoveItemButton } from './Editable'
import { getPublicPackages } from '../api/packages'
import Reveal from './Reveal'

const copy = {
  en: {
    perOne: (n) => `Single participation cost: ֏${n.toLocaleString()}`,
    savingsLabel: 'Your savings:',
    savings: (n) => `֏${n.toLocaleString()}`,
    includes: 'Package includes:',
    neverExpires: 'No expiry',
    validMonths: (n) => `Valid for ${n} month${n === 1 ? '' : 's'} from purchase`,
    validDays: (n) => `Valid for ${n} day${n === 1 ? '' : 's'} from purchase`,
    telegramIncluded: 'Access to the private Telegram club',
    popular: 'Most popular',
    bestValue: 'Best value',
  },
  hy: {
    perOne: (n) => `Մեկ մասնակցության արժեքը՝ ֏${n.toLocaleString()}`,
    savingsLabel: 'Ձեր խնայողությունը՝',
    savings: (n) => `֏${n.toLocaleString()}`,
    includes: 'Փաթեթը ներառում է՝',
    neverExpires: 'Ժամկետ չունի',
    validMonths: (n) => `Փաթեթը գործում է գնման օրվանից ${n} ամիս`,
    validDays: (n) => `Փաթեթը գործում է գնման օրվանից ${n} օր`,
    telegramIncluded: 'Telegram ակումբի հասանելիություն փաթեթի գործողության ընթացքում',
    popular: 'Ամենապահանջված',
    bestValue: 'Ամենաշահավետ',
  },
}

export default function Pricing({ lang }) {
  const { user } = useAuth()
  const { openRegister } = useAuthModal()
  const navigate = useNavigate()
  const t = useContent()
  const c = t.pricing
  const hy = lang === 'hy'
  const tr = copy[lang] ?? copy.en
  const suffix = hy ? 'Hy' : 'En'
  const p = (b) => `pricing.${b}${suffix}`
  const v = (b) => (hy ? c[`${b}Hy`] : c[`${b}En`])
  const paragraphs = Array.isArray(v('sub')) ? v('sub') : [v('sub')].filter(Boolean)
  const terms = Array.isArray(v('terms')) ? v('terms') : []

  const [packages, setPackages] = useState([])
  const [termsOpen, setTermsOpen] = useState(false)

  useEffect(() => {
    getPublicPackages().then(setPackages).catch(() => setPackages([]))
  }, [])

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
          const perOne = pkg.eventCount > 0 ? Math.round(pkg.price / pkg.eventCount) : pkg.price
          const savings = pkg.regularPrice != null ? pkg.regularPrice - pkg.price : 0
          const items = (hy ? pkg.itemsHy : pkg.itemsEn) || []
          const description = hy ? pkg.descriptionHy : pkg.descriptionEn
          const gold = pkg.badge === 'best_value'
          const popular = pkg.badge === 'popular'
          return (
            <Reveal as="div" className={`plan${popular ? ' hero-plan' : ''}${gold ? ' gold-plan' : ''}`} key={pkg.id} delay={120 + pos * 90}>
              {pkg.badge && (
                <div className="plan-badge-pill">
                  {pkg.badge === 'popular' ? <Star size={13} /> : <Crown size={13} />}
                  {pkg.badge === 'popular' ? tr.popular : tr.bestValue}
                </div>
              )}
              <div className="plan-name">{hy ? pkg.nameHy : pkg.nameEn}</div>
              <div className="plan-price-row">
                <div className="plan-price"><sup>֏</sup>{Number(pkg.price).toLocaleString()}</div>
                {pkg.regularPrice != null && (
                  <div className="plan-regular-price">֏{Number(pkg.regularPrice).toLocaleString()}</div>
                )}
              </div>
              {pkg.eventCount > 1 && <p className="plan-per-one">{tr.perOne(perOne)}</p>}
              {savings > 0 && (
                <div className="plan-savings-box">
                  <div className="plan-savings-label">{tr.savingsLabel}</div>
                  <div className="plan-savings-amount">{tr.savings(savings)}</div>
                </div>
              )}
              {description && <p className="plan-description">{description}</p>}
              <div className="plan-hero-div"></div>
              {items.length > 0 && (
                <>
                  <p className="plan-includes-label">{tr.includes}</p>
                  <ul className="plan-list">
                    {items.map((item, j) => (
                      <li key={j}><Check size={12} />{item}</li>
                    ))}
                    {pkg.telegramAccess && <li><Check size={12} />{tr.telegramIncluded}</li>}
                  </ul>
                </>
              )}
              <div className="plan-validity">
                {pkg.validityDays == null
                  ? tr.neverExpires
                  : pkg.validityDays % 30 === 0
                    ? tr.validMonths(pkg.validityDays / 30)
                    : tr.validDays(pkg.validityDays)}
              </div>
              <button type="button" className={`plan-btn ${pkg.badge ? 'plan-btn-fill' : 'plan-btn-outline'}`} onClick={() => (user ? navigate('/dashboard') : openRegister())}>
                {v('btn')}
              </button>
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

      {terms.length > 0 && (
        <Reveal as="div" className="pricing-terms">
          <button type="button" className="pricing-terms-toggle" onClick={() => setTermsOpen((o) => !o)}>
            <E as="span" path={p('termsTitle')} value={v('termsTitle')} />
            <ChevronDown size={18} className={termsOpen ? 'pricing-terms-chevron open' : 'pricing-terms-chevron'} />
          </button>
          {termsOpen && (
            <>
              <ul className="pricing-terms-list">
                {terms.map((term, i) => (
                  <li key={i} className="hc-item-row">
                    <E as="span" path={p('terms')} value={term} listIndex={i} />
                    {terms.length > 1 && <RemoveItemButton paths={[p('terms')]} index={i} />}
                  </li>
                ))}
              </ul>
              <AddItemButton paths={[p('terms')]} label={hy ? 'Ավելացնել պայման' : 'Add term'} />
            </>
          )}
        </Reveal>
      )}
    </section>
  )
}
