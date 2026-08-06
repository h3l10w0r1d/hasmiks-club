import PackageCard, { packageCardClassName } from './PackageCard'

const emptyCopy = {
  en: 'No packages are available right now — please check back soon.',
  hy: 'Այս պահին փաթեթներ հասանելի չեն, խնդրում ենք փորձել ավելի ուշ։',
}

/** Shared package-selection grid used by WelcomePage, GiftPage, and
 * Dashboard's "buy another package" flow — purely presentational; the
 * caller owns fetching `packages` (getPublicPackages) and what happens on
 * selection/checkout. Renders each package with the exact same card look as
 * the landing page's pricing section (via PackageCard), so a package looks
 * identical everywhere it's shown — only the selection affordance differs. */
export default function PackagePicker({ packages, selected, onSelect, lang = 'en', className = '' }) {
  if (!packages || packages.length === 0) {
    return <p style={{ fontSize: 14, color: '#A99B8A' }}>{lang === 'hy' ? emptyCopy.hy : emptyCopy.en}</p>
  }

  return (
    <div className={`plans plans-picker${className ? ` ${className}` : ''}`}>
      {packages.map((pkg) => {
        const isSelected = selected === pkg.id
        return (
          <div
            key={pkg.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(pkg.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(pkg.id) } }}
            className={packageCardClassName(pkg, isSelected ? 'plan-selected' : '')}
          >
            <PackageCard pkg={pkg} lang={lang} />
          </div>
        )
      })}
    </div>
  )
}
