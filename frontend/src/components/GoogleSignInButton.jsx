import { useEffect, useRef, useState } from 'react'
import { googleSignIn } from '../api/auth'
import { GoogleIcon } from './SocialIcons'
import { SQUARE_SIZE } from './socialButtonStyle'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

let scriptPromise = null
function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

/**
 * A compact, icon-only "Continue with Google" square — one of a row of
 * equal provider buttons. Uses Google's OAuth2 implicit token-client popup
 * flow (google.accounts.oauth2.initTokenClient), triggered directly from
 * our own always-visible button's onClick.
 *
 * This deliberately isn't the classic ID-token renderButton()/One Tap
 * approach (an invisible Google-rendered button/prompt layered over a
 * custom square) that shipped first — that turned out to reproducibly fail
 * silently in real use: renderButton()'s injected iframe sizes itself to
 * 0×0 regardless of button type, and prompt() never even attempts a
 * network request. Both symptoms point at the same cause — those flows
 * lean on third-party-cookie/FedCM access that's increasingly restricted
 * by default across browsers. A real top-level popup window (what this
 * flow opens) has no such dependency, and if something IS misconfigured
 * (e.g. this origin isn't authorized for the OAuth client), the popup
 * itself shows a real, visible Google error page instead of nothing
 * happening at all — which is also just a much easier thing to debug.
 *
 * On success, sends the resulting access token to the backend, which
 * verifies it by asking Google's own userinfo endpoint who it belongs to
 * (not a local JWT check, since there's no ID token in this flow).
 */
export default function GoogleSignInButton({ lang = 'en', referralCode, onSuccess, onError }) {
  const [ready, setReady] = useState(false)
  const tokenClientRef = useRef(null)
  // The token client's callback is created once, on mount — it reads the
  // latest props from this ref rather than closing over them directly, so
  // a referralCode/onSuccess/onError change doesn't require tearing down
  // and recreating the client (and doesn't risk a stale closure either).
  const latestRef = useRef({ lang, referralCode, onSuccess, onError })
  useEffect(() => {
    latestRef.current = { lang, referralCode, onSuccess, onError }
  })

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGoogleScript().then(() => {
      if (cancelled) return
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'email profile',
        callback: async (response) => {
          const { lang, referralCode, onSuccess, onError } = latestRef.current
          // 'popup_closed' / 'access_denied' — the member closed the
          // window or declined; not worth surfacing as an error.
          if (response.error) {
            if (response.error !== 'popup_closed' && response.error !== 'access_denied') {
              onError?.(lang === 'hy' ? 'Google մուտքը ձախողվեց' : 'Google sign-in failed')
            }
            return
          }
          try {
            const data = await googleSignIn(response.access_token, referralCode)
            onSuccess?.(data)
          } catch {
            onError?.(lang === 'hy' ? 'Google մուտքը ձախողվեց' : 'Google sign-in failed')
          }
        },
      })
      setReady(true)
    }).catch(() => onError?.(lang === 'hy' ? 'Google մուտքը հասանելի չէ' : 'Google sign-in unavailable'))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!CLIENT_ID) return null

  return (
    <button
      type="button"
      title="Google"
      aria-label="Continue with Google"
      disabled={!ready}
      onClick={() => tokenClientRef.current?.requestAccessToken()}
      style={{
        width: SQUARE_SIZE, height: SQUARE_SIZE, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--sand)', borderRadius: 10, background: '#fff',
        cursor: ready ? 'pointer' : 'default', boxSizing: 'border-box',
        opacity: ready ? 1 : 0.6, transition: 'opacity .15s',
      }}
    >
      <GoogleIcon size={22} />
    </button>
  )
}
