import { Star, Crown, Check } from 'lucide-react'

// Single source of truth for the package-card copy so every place a package
// is shown (landing pricing section, dashboard/welcome/gift pickers) reads
// identically — previously PackagePicker.jsx kept its own near-duplicate
// strings that drifted out of sync with Pricing.jsx (a typo, a missing
// savings box).
export const packageCardCopy = {
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

export function packageCardClassName(pkg, extra = '') {
  const popular = pkg.badge === 'popular'
  const gold = pkg.badge === 'best_value'
  return `plan${popular ? ' hero-plan' : ''}${gold ? ' gold-plan' : ''}${extra ? ` ${extra}` : ''}`
}

/** The card's inner content — badge pill through validity line. Deliberately
 * has no outer wrapping element so callers can host it inside whatever they
 * need (a Reveal-animated div on the landing page, a plain selectable div in
 * a picker grid) while sharing the exact same look via the `.plan` CSS
 * classes in App.css. `footer` renders below the validity line (e.g.
 * Pricing's "Join now" button) — PackagePicker has none, since the whole
 * card itself is the selection control there. */
export default function PackageCard({ pkg, lang, footer }) {
  const hy = lang === 'hy'
  const t = packageCardCopy[lang] ?? packageCardCopy.en
  const perOne = pkg.eventCount > 0 ? Math.round(pkg.price / pkg.eventCount) : pkg.price
  const savings = pkg.regularPrice != null ? pkg.regularPrice - pkg.price : 0
  const items = (hy ? pkg.itemsHy : pkg.itemsEn) || []
  const description = hy ? pkg.descriptionHy : pkg.descriptionEn

  return (
    <>
      {pkg.badge && (
        <div className="plan-badge-pill">
          {pkg.badge === 'popular' ? <Star size={13} /> : <Crown size={13} />}
          {pkg.badge === 'popular' ? t.popular : t.bestValue}
        </div>
      )}
      <div className="plan-name">{hy ? pkg.nameHy : pkg.nameEn}</div>
      <div className="plan-price-row">
        <div className="plan-price"><sup>֏</sup>{Number(pkg.price).toLocaleString()}</div>
        {pkg.regularPrice != null && (
          <div className="plan-regular-price">֏{Number(pkg.regularPrice).toLocaleString()}</div>
        )}
      </div>
      {pkg.eventCount > 1 && <p className="plan-per-one">{t.perOne(perOne)}</p>}
      {savings > 0 && (
        <div className="plan-savings-box">
          <div className="plan-savings-label">{t.savingsLabel}</div>
          <div className="plan-savings-amount">{t.savings(savings)}</div>
        </div>
      )}
      {description && <p className="plan-description">{description}</p>}
      <div className="plan-hero-div"></div>
      {items.length > 0 && (
        <>
          <p className="plan-includes-label">{t.includes}</p>
          <ul className="plan-list">
            {items.map((item, j) => (
              <li key={j}><Check size={12} />{item}</li>
            ))}
            {pkg.telegramAccess && <li><Check size={12} />{t.telegramIncluded}</li>}
          </ul>
        </>
      )}
      <div className="plan-validity">
        {pkg.validityDays == null
          ? t.neverExpires
          : pkg.validityDays % 30 === 0
            ? t.validMonths(pkg.validityDays / 30)
            : t.validDays(pkg.validityDays)}
      </div>
      {footer}
    </>
  )
}
