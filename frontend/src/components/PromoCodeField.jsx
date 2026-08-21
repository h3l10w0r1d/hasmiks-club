import { useState } from 'react'
import { Tag, Check, X } from 'lucide-react'
import { previewPromo } from '../api/packages'

/**
 * "Have a promo code?" input for the package purchase flows.
 *
 * Owns only the entry/validation UI; the applied result is handed to the
 * caller via `onApplied` so the caller can show the new total and pass the
 * code to checkoutPackage. The code is re-validated server-side at checkout,
 * so nothing here is trusted for pricing — this is purely so the member sees
 * what they'll pay before committing.
 *
 * A code can be restricted to particular packages, so a discount applied to
 * one package must never appear to carry over to another. Rather than reset
 * state from an effect, callers mount this with `key={packageKey}` so React
 * remounts it on selection change, and clear their own applied-promo state in
 * the same handler that changes the selection.
 */
export default function PromoCodeField({ packageKey, lang = 'en', onApplied }) {
  const hy = lang === 'hy'
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(null)

  const t = {
    have:    hy ? 'Ունե՞ք պրոմո կոդ' : 'Have a promo code?',
    label:   hy ? 'Պրոմո կոդ' : 'Promo code',
    apply:   hy ? 'Կիրառել' : 'Apply',
    checking:hy ? 'Ստուգվում է…' : 'Checking…',
    remove:  hy ? 'Հեռացնել' : 'Remove',
    generic: hy ? 'Կոդը ստուգել չհաջողվեց' : "Couldn't check that code",
    bonus:   (n) => hy ? `+${n} անվճար այց` : `+${n} free visit${n === 1 ? '' : 's'}`,
  }

  const apply = async () => {
    const entered = code.trim()
    if (!entered || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await previewPromo(entered, packageKey, lang)
      if (!res.valid) {
        setApplied(null)
        onApplied?.(null)
        setError(res.message || t.generic)
      } else {
        setApplied(res)
        onApplied?.(res)
      }
    } catch (err) {
      setApplied(null)
      onApplied?.(null)
      setError(err?.response?.data?.detail || t.generic)
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    setApplied(null)
    setCode('')
    setError('')
    onApplied?.(null)
  }

  if (!open && !applied) {
    return (
      <button type="button" className="promo-toggle" onClick={() => setOpen(true)}>
        <Tag size={14} /> {t.have}
      </button>
    )
  }

  if (applied) {
    return (
      <div className="promo-applied">
        <span className="promo-applied-badge"><Check size={13} /> {applied.code}</span>
        <span className="promo-applied-detail">
          {applied.discount_amount > 0 && `−֏${Number(applied.discount_amount).toLocaleString()}`}
          {applied.discount_amount > 0 && applied.bonus_credits > 0 && ' · '}
          {applied.bonus_credits > 0 && t.bonus(applied.bonus_credits)}
        </span>
        <button type="button" className="promo-clear" onClick={clear} title={t.remove}><X size={13} /></button>
      </div>
    )
  }

  return (
    <div className="promo-field">
      <div className="promo-row">
        <input
          className="promo-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
          placeholder={t.label}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="promo-apply" onClick={apply} disabled={busy || !code.trim()}>
          {busy ? t.checking : t.apply}
        </button>
      </div>
      {error && <p className="promo-error">{error}</p>}
    </div>
  )
}
