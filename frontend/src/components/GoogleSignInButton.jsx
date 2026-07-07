import { useEffect, useRef, useState } from 'react'
import { googleSignIn } from '../api/auth'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Google's button text language is set via ?hl= on the script URL (the
// renderButton "locale" option does not control it), so cache one script
// load per language rather than a single global singleton.
const scriptPromises = {}
function loadGoogleScript(hl) {
  if (window.google?.accounts?.id && scriptPromises[hl]) return scriptPromises[hl]
  if (!scriptPromises[hl]) {
    scriptPromises[hl] = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://accounts.google.com/gsi/client?hl=${hl}`
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  return scriptPromises[hl]
}

/**
 * Renders Google's own "Sign in with Google" button. On success, verifies the
 * credential with the backend (which auto-links to an existing email/password
 * account, or creates a new member) and calls onSuccess with the TokenOut data —
 * the caller decides how to route/redirect (same shape as the email login flow).
 */
export default function GoogleSignInButton({ lang = 'en', referralCode, onSuccess, onError }) {
  const divRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    const hl = lang === 'hy' ? 'hy' : 'en'
    loadGoogleScript(hl).then(() => {
      if (cancelled || !divRef.current) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            const data = await googleSignIn(credential, referralCode)
            onSuccess?.(data)
          } catch {
            onError?.(lang === 'hy' ? 'Google մուտքը ձախողվեց' : 'Google sign-in failed')
          }
        },
      })
      window.google.accounts.id.renderButton(divRef.current, {
        theme: 'outline', size: 'large', width: 320, text: 'continue_with',
      })
      setReady(true)
    }).catch(() => onError?.(lang === 'hy' ? 'Google մուտքը հասանելի չէ' : 'Google sign-in unavailable'))
    return () => { cancelled = true }
  }, [lang])

  if (!CLIENT_ID) return null

  return <div ref={divRef} style={{ display: 'flex', justifyContent: 'center', minHeight: ready ? 'auto' : 44 }} />
}
