import { useEffect, useRef, useState } from 'react'
import { googleSignIn } from '../api/auth'
import { GoogleIcon } from './SocialIcons'
import { SQUARE_SIZE } from './socialButtonStyle'

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
 * A compact, icon-only "Continue with Google" square — one of a row of equal
 * provider buttons. Google's own rendered icon button (which otherwise varies
 * by browser/locale — Chrome's FedCM account chooser renders in the OS/browser
 * language, not ours) is kept but made invisible and centered on top of our
 * own square — the standard technique for custom OAuth buttons: the real
 * click still lands on Google's widget, only the visuals are ours. On
 * success, verifies the credential with the backend (auto-links to an
 * existing email/password account, or creates a new member) and calls
 * onSuccess with the TokenOut data.
 */
export default function GoogleSignInButton({ lang = 'en', referralCode, onSuccess, onError }) {
  const overlayRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    const hl = lang === 'hy' ? 'hy' : 'en'
    loadGoogleScript(hl).then(() => {
      if (cancelled || !overlayRef.current) return
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
      overlayRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(overlayRef.current, {
        type: 'icon', shape: 'square', size: 'large',
      })
      setReady(true)
    }).catch(() => onError?.(lang === 'hy' ? 'Google մուտքը հասանելի չէ' : 'Google sign-in unavailable'))
    return () => { cancelled = true }
  }, [lang])

  if (!CLIENT_ID) return null

  return (
    <div style={{ position: 'relative', width: SQUARE_SIZE, height: SQUARE_SIZE }}>
      <button type="button" tabIndex={-1} aria-hidden="true" title="Google" style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--sand)', borderRadius: 10, background: '#fff', cursor: 'pointer', boxSizing: 'border-box',
      }}>
        <GoogleIcon size={22} />
      </button>
      <div ref={overlayRef} style={{
        position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: ready ? 'auto' : 'none',
      }} />
    </div>
  )
}
