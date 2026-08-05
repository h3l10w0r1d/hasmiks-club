import { useEffect, useRef, useState } from 'react'
import { TelegramIcon } from './SocialIcons'
import { SQUARE_SIZE } from './socialButtonStyle'

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * A compact, icon-only "Continue with Telegram" square — matches
 * GoogleSignInButton so the two sit side by side as an equal row. Telegram's
 * own login widget is kept invisible and centered on top of our own square
 * (same overlay technique as before), but now configured for REDIRECT mode
 * (data-auth-url) instead of the JS-callback mode (data-onauth) it used to
 * use.
 *
 * JS-callback mode opens its confirmation popup via window.open() from
 * inside the widget's iframe — that reproducibly failed to open at all, even
 * when testing Telegram's own unmodified widget directly outside our app
 * entirely (the same class of popup/FedCM-dependent failure
 * GoogleSignInButton.jsx hit and fixed by switching away from a
 * popup-opening flow). Redirect mode does a plain top-level page navigation
 * instead — no popup involved, so there's nothing for a browser to block.
 *
 * Because this is a real navigation away from the page, there's no
 * client-side success/error callback anymore — the backend's
 * GET /auth/telegram/callback verifies the signed payload Telegram appends
 * to this URL and redirects on to TelegramAuthCompletePage.jsx (at `next`,
 * or /dashboard by default) with a token, or an error.
 */
export default function TelegramLoginButton({ referralCode, next = '/dashboard' }) {
  const overlayRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!BOT_USERNAME || !overlayRef.current) return
    setReady(false)

    const authUrl = new URL('/auth/telegram/callback', API_BASE_URL)
    if (referralCode) authUrl.searchParams.set('referral_code', referralCode)
    authUrl.searchParams.set('next', next)

    overlayRef.current.innerHTML = ''
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'small')
    script.setAttribute('data-auth-url', authUrl.toString())
    script.onload = () => setReady(true)
    overlayRef.current.appendChild(script)

    return () => {
      if (overlayRef.current) overlayRef.current.innerHTML = ''
    }
  }, [referralCode, next])

  if (!BOT_USERNAME) return null

  return (
    // flexShrink: 0 — sitting in a `justify-content: center; gap` row next
    // to GoogleSignInButton, this square was found shrinking down to ~26px
    // when the row was tight, while Telegram's iframe (rendered at its own
    // fixed intrinsic size, not responsive to the container) stayed put —
    // the mismatch pushed the real clickable iframe outside this square
    // entirely. Unlike Google, Telegram's widget exposes no JS API to
    // trigger sign-in independent of that iframe, so keeping this square a
    // reliable, un-shrunk 52×52 target is what the overlay technique
    // actually depends on here.
    <div style={{ position: 'relative', width: SQUARE_SIZE, height: SQUARE_SIZE, flexShrink: 0 }}>
      <button type="button" tabIndex={-1} aria-hidden="true" title="Telegram" disabled={!ready} style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--sand)', borderRadius: 10, background: '#fff', boxSizing: 'border-box',
        cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6, transition: 'opacity .15s',
      }}>
        <TelegramIcon size={24} />
      </button>
      {/* overflow stays hidden — Telegram's iframe renders much wider
          (~148px) than this 52px square and gets centered across it, so an
          unclipped version bleeds ~48px into whichever button sits next to
          it (confirmed: it was intercepting clicks meant for the Google
          button beside it). Clipping still leaves the iframe's own center
          — where Telegram renders its actual clickable widget — inside
          our visible bounds. */}
      <div ref={overlayRef} style={{
        position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: ready ? 'auto' : 'none',
      }} />
    </div>
  )
}
