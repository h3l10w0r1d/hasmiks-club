import { Star, Crown, CheckCircle2 } from 'lucide-react'

const copy = {
  en: {
    perEvent: (n) => `֏${n.toLocaleString()} / event`,
    events: (n) => `${n} event${n === 1 ? '' : 's'}`,
    neverExpires: 'No expiry',
    validMonths: (n) => `Valid for ${n} month${n === 1 ? '' : 's'}`,
    validDays: (n) => `Valid for ${n} day${n === 1 ? '' : 's'}`,
    popular: 'Most popular',
    bestValue: 'Best value',
    savingsLabel: 'Your savings:',
    savings: (n) => `֏${n.toLocaleString()}`,
    empty: 'No packages are available right now — please check back soon.',
  },
  hy: {
    perEvent: (n) => `֏${n.toLocaleString()} / միջոցառում`,
    events: (n) => `${n} մասնակցություն`,
    neverExpires: 'Ժամկետ չունի',
    validMonths: (n) => `Գործում է ${n} ամիս`,
    validDays: (n) => `Գործում է ${n} օր`,
    popular: 'Ամենապահանջված',
    bestValue: 'Ամենաշահավետ',
    savingsLabel: 'Ձեր խնայողությունը՝',
    savings: (n) => `֏${n.toLocaleString()}`,
    empty: 'Այս պահին փաթեթներ հասանելի չեն, խնդրում ենք փորձել ավելի ուշ։',
  },
}

/** Shared package-selection grid used by WelcomePage, GiftPage, and
 * Dashboard's "buy another package" flow — purely presentational; the
 * caller owns fetching `packages` (getPublicPackages) and what happens on
 * selection/checkout. */
export default function PackagePicker({ packages, selected, onSelect, lang = 'en' }) {
  const t = copy[lang] ?? copy.en
  const hy = lang === 'hy'

  if (!packages || packages.length === 0) {
    return <p style={{ fontSize: 14, color: '#A99B8A' }}>{t.empty}</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {packages.map((pkg) => {
        const isSelected = selected === pkg.id
        const perEvent = pkg.eventCount > 0 ? Math.round(pkg.price / pkg.eventCount) : pkg.price
        const savings = pkg.regularPrice != null ? pkg.regularPrice - pkg.price : 0
        const items = hy ? pkg.itemsHy : pkg.itemsEn
        return (
          <button
            key={pkg.id} type="button" onClick={() => onSelect(pkg.id)}
            style={{
              textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: '18px 20px',
              border: `2px solid ${isSelected ? 'var(--rose, #7E3434)' : 'var(--sand, #e5d5d5)'}`,
              background: isSelected ? 'var(--rose-bg, #fdecec)' : '#fff',
              fontFamily: 'inherit',
            }}
          >
            {pkg.badge && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--rose, #7E3434)', marginBottom: 6 }}>
                {pkg.badge === 'popular' ? <Star size={12} /> : <Crown size={12} />}
                {pkg.badge === 'popular' ? t.popular : t.bestValue}
              </div>
            )}
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--deep, #180C04)', marginBottom: 4 }}>
              {hy ? pkg.nameHy : pkg.nameEn}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--rose, #7E3434)' }}>
                ֏{Number(pkg.price).toLocaleString()}
              </div>
              {pkg.regularPrice != null && (
                <div style={{ fontSize: 13, color: 'var(--stone, #82715C)', textDecoration: 'line-through' }}>
                  ֏{Number(pkg.regularPrice).toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--taupe, #786050)', marginBottom: 8 }}>
              {t.events(pkg.eventCount)}
              {pkg.eventCount > 1 && ` · ${t.perEvent(perEvent)}`}
            </div>
            {savings > 0 && (
              <div style={{
                display: 'inline-block', borderRadius: 10, padding: '8px 12px', marginBottom: 10,
                background: pkg.badge === 'best_value' ? 'rgba(140,101,48,0.1)' : 'var(--rose-bg, #fdecec)',
                color: pkg.badge === 'best_value' ? 'var(--gold, #8C6530)' : 'var(--rose, #7E3434)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{t.savingsLabel}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.savings(savings)}</div>
              </div>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item, j) => (
                <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                  <CheckCircle2 size={14} strokeWidth={2} color="var(--rose, #7E3434)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div style={{ fontSize: 12, color: 'var(--taupe, #786050)' }}>
              {pkg.validityDays == null
                ? t.neverExpires
                : pkg.validityDays % 30 === 0
                  ? t.validMonths(pkg.validityDays / 30)
                  : t.validDays(pkg.validityDays)}
            </div>
          </button>
        )
      })}
    </div>
  )
}
