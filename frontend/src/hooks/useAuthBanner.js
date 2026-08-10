import { useEffect, useState } from 'react'
import { getPublicSettings } from '../api/payments'
import authBannerHy from '../assets/auth-banner-hy.jpg'
import authBannerEn from '../assets/auth-banner-en.jpg'

// Shipped fallbacks — what every install shows until an admin uploads their own.
const BUNDLED = { hy: authBannerHy, en: authBannerEn }

// One in-flight request shared by every caller. AuthShell (the /login and
// /register routes) and AuthModal (the app-wide popup) can both mount in a
// single session, and there's no reason to ask twice.
let settingsPromise = null
function loadSettings() {
  if (!settingsPromise) settingsPromise = getPublicSettings().catch(() => ({}))
  return settingsPromise
}

/**
 * The login/register side image for `lang` — the admin's uploaded override
 * (Admin → Settings → Club Info → "Login/Register banner") when one is set,
 * otherwise the image bundled at build time.
 *
 * Starts on the bundled image rather than empty so the popup never flashes a
 * blank panel while the settings request is in flight; the custom URL swaps in
 * once it arrives. A failed request just leaves the default in place.
 */
export function useAuthBanner(lang) {
  const key = lang === 'hy' ? 'hy' : 'en'
  // Both languages are stored, and the one to show is picked during render —
  // so switching language mid-session swaps the image with no extra request,
  // and there's no synchronous setState resetting it on every change.
  const [custom, setCustom] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadSettings().then((s) => {
      if (!cancelled) setCustom({ hy: s?.auth_banner_hy || '', en: s?.auth_banner_en || '' })
    })
    return () => { cancelled = true }
  }, [])

  return custom?.[key] || BUNDLED[key]
}
