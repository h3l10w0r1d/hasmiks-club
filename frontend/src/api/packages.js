import client from './client'

export const getPublicPackages = () =>
  client.get('/packages/public').then((r) => r.data)

export const getMyPackages = () =>
  client.get('/packages/my').then((r) => r.data)

// Returns either {mode:"redirect", url} (no card on file — the caller
// should navigate to `url`) or {mode:"instant", success, message?} (a
// bound card was charged synchronously — no navigation needed).
export const checkoutPackage = (package_key, lang_pref) =>
  client.post('/packages/checkout', { package_key, lang_pref }).then((r) => r.data)

export const removeCard = () =>
  client.post('/packages/remove-card').then((r) => r.data)
