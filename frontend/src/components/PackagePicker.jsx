import PackageCard, { packageCardClassName } from './PackageCard'
import PackageRow from './PackageRow'

const emptyCopy = {
  en: 'No packages are available right now — please check back soon.',
  hy: 'Այս պահին փաթեթներ հասանելի չեն, խնդրում ենք փորձել ավելի ուշ։',
}

/** Shared package-selection UI used by WelcomePage, GiftPage, the post-register
 * modal, and Dashboard's "buy another package" flow — purely presentational;
 * the caller owns fetching `packages` (getPublicPackages) and what happens on
 * selection/checkout.
 *
 * `layout="cards"` (default) renders each package with the exact same card
 * look as the landing page's pricing section (via PackageCard), so a package
 * looks identical everywhere it's shown. `layout="rows"` renders the compact
 * PackageRow instead, for callers whose column is too narrow to fit those
 * cards side by side. */
export default function PackagePicker({ packages, selected, onSelect, lang = 'en', className = '', layout = 'cards' }) {
  if (!packages || packages.length === 0) {
    return <p style={{ fontSize: 14, color: '#A99B8A' }}>{lang === 'hy' ? emptyCopy.hy : emptyCopy.en}</p>
  }

  if (layout === 'rows') {
    return (
      <div className={`plans-picker-list${className ? ` ${className}` : ''}`} role="radiogroup">
        {packages.map((pkg) => (
          <PackageRow
            key={pkg.id}
            pkg={pkg}
            lang={lang}
            selected={selected === pkg.id}
            onSelect={() => onSelect(pkg.id)}
          />
        ))}
      </div>
    )
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
