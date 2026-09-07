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
            // A package that isn't on sale yet can be read but not chosen.
            onSelect={pkg.comingSoon ? undefined : () => onSelect(pkg.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`plans plans-picker${className ? ` ${className}` : ''}`}>
      {packages.map((pkg) => {
        const isSelected = selected === pkg.id
        const soon = !!pkg.comingSoon
        return (
          <div
            key={pkg.id}
            // Not yet on sale: readable, but not a control — no click, no tab
            // stop, and announced as disabled rather than selectable.
            role={soon ? undefined : 'button'}
            tabIndex={soon ? undefined : 0}
            aria-disabled={soon || undefined}
            onClick={soon ? undefined : () => onSelect(pkg.id)}
            onKeyDown={soon ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(pkg.id) } }}
            className={packageCardClassName(pkg, isSelected ? 'plan-selected' : '')}
          >
            <PackageCard pkg={pkg} lang={lang} />
          </div>
        )
      })}
    </div>
  )
}
