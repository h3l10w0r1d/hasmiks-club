// Generic reorder/show-hide helper for repeatable card lists (Community's
// "what you get" cards, Pricing's plan cards). Order and visibility are stored
// as plain content overrides (e.g. "community.__ptsOrder" / "community.__ptsHidden")
// — the same flat-path mechanism as every other override — so no schema or
// backend change is needed to support it.

export function defaultOrder(count) {
  return Array.from({ length: count }, (_, i) => i)
}

// Full order including hidden items — always exactly `count` long, falling
// back to identity order if the stored value is missing or stale (e.g. the
// content array's length changed since the override was saved).
export function fullOrder(orderArr, count) {
  return Array.isArray(orderArr) && orderArr.length === count ? orderArr : defaultOrder(count)
}

// Original indices in display order, with hidden ones removed.
export function visibleOrder(orderArr, hiddenArr, count) {
  const order = fullOrder(orderArr, count)
  const hidden = Array.isArray(hiddenArr) ? hiddenArr : []
  return order.filter((i) => !hidden[i])
}

export function moveInOrder(orderArr, hiddenArr, count, index, dir) {
  const order = fullOrder(orderArr, count)
  const hidden = Array.isArray(hiddenArr) ? hiddenArr : []
  const pos = order.indexOf(index)
  if (pos < 0) return order
  const step = dir === 'left' || dir === 'up' ? -1 : 1
  let j = pos + step
  while (j >= 0 && j < order.length && hidden[order[j]]) j += step
  if (j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[pos], next[j]] = [next[j], next[pos]]
  return next
}

export function toggleHidden(hiddenArr, count, index) {
  const hidden = Array.isArray(hiddenArr) && hiddenArr.length === count ? [...hiddenArr] : new Array(count).fill(false)
  hidden[index] = !hidden[index]
  return hidden
}
