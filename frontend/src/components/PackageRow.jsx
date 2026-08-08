import { Star, Crown, Check } from 'lucide-react'
import { packageCardCopy } from './PackageCard'

/** One package as a compact, selectable row — the alternative to PackageCard
 * for pickers that live in a narrow column (GiftPage's 620px form, the
 * dashboard's membership card), where the full pricing cards either overflow
 * into a sideways scroll or stack into a very tall list. Reads the same copy
 * table as PackageCard so prices/labels can't drift apart; the difference is
 * only how much shows at rest — the feature list is revealed for the selected
 * package alone, which is the one the member is actually deciding on. */
export default function PackageRow({ pkg, lang, selected, onSelect }) {
  const hy = lang === 'hy'
  const t = packageCardCopy[lang] ?? packageCardCopy.en
  const perOne = pkg.eventCount > 0 ? Math.round(pkg.price / pkg.eventCount) : pkg.price
  const items = (hy ? pkg.itemsHy : pkg.itemsEn) || []
  const gold = pkg.badge === 'best_value'

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={`pkg-row${selected ? ' pkg-row-selected' : ''}${gold ? ' pkg-row-gold' : ''}`}
    >
      <span className="pkg-row-radio" aria-hidden="true" />
      <div className="pkg-row-main">
        {/* Price lives inside the header rather than in its own column so it
            can wrap onto its own line on a narrow screen — as a fixed side
            column it squeezed the feature list into a ~126px strip that
            wrapped every line two or three times. */}
        <div className="pkg-row-head">
          <span className="pkg-row-name">{hy ? pkg.nameHy : pkg.nameEn}</span>
          {pkg.badge && (
            <span className="pkg-row-badge">
              {gold ? <Crown size={11} /> : <Star size={11} />}
              {gold ? t.bestValue : t.popular}
            </span>
          )}
          <span className="pkg-row-price">
            <span className="pkg-row-amount">֏{Number(pkg.price).toLocaleString()}</span>
            {pkg.regularPrice != null && (
              <span className="pkg-row-regular">֏{Number(pkg.regularPrice).toLocaleString()}</span>
            )}
            {pkg.eventCount > 1 && <span className="pkg-row-per">{t.perOneShort(perOne)}</span>}
          </span>
        </div>
        {selected && (items.length > 0 || pkg.telegramAccess) && (
          <ul className="pkg-row-list">
            {items.map((item, i) => <li key={i}><Check size={11} />{item}</li>)}
            {pkg.telegramAccess && <li><Check size={11} />{t.telegramIncluded}</li>}
          </ul>
        )}
        {selected && (
          <div className="pkg-row-validity">
            {pkg.validityDays == null
              ? t.neverExpires
              : pkg.validityDays % 30 === 0
                ? t.validMonths(pkg.validityDays / 30)
                : t.validDays(pkg.validityDays)}
          </div>
        )}
      </div>
    </div>
  )
}
