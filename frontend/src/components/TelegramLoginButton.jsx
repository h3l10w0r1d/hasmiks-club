import { useEffect, useRef, useState } from 'react'
import { telegramSignIn } from '../api/auth'
import { TelegramIcon } from './SocialIcons'
import { SQUARE_SIZE } from './socialButtonStyle'

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
const CALLBACK_NAME = '__hasmiksTelegramAuth'

/**
 * A compact, icon-only "Continue with Telegram" square — matches
 * GoogleSignInButton so the two sit side by side as an equal row. Telegram's
 * own login widget (their documented script-tag integration; it has no true
 * icon-only mode, "small" is the closest) is kept but made invisible and
 * centered on top of our own square — same overlay technique as Google's
 * button, so the real click still lands on Telegram's widget. On success,
 * sends the widget's signed payload to the backend, which verifies it
 * server-side (Telegram never exposes a client-side verification API) and
 * either logs into an existing telegram-linked account or creates a new
 * one — Telegram provides no email, so there is no auto-link-by-email path
 * here like with Google.
 */
export default function TelegramLoginButton({ lang = 'en', referralCode, onSuccess, onError }) {
  const overlayRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!BOT_USERNAME || !overlayRef.current) return
    setReady(false)

    window[CALLBACK_NAME] = async (telegramUser) => {
      try {
        const data = await telegramSignIn(telegramUser, referralCode)
        onSuccess?.(data)
      } catch {
        onError?.(lang === 'hy' ? 'Telegram մուտքը ձախողվեց' : 'Telegram sign-in failed')
      }
    }

    overlayRef.current.innerHTML = ''
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'small')
    script.setAttribute('data-onauth', `${CALLBACK_NAME}(user)`)
    script.onload = () => setReady(true)
    script.onerror = () => onError?.(lang === 'hy' ? 'Telegram մուտքը հասանելի չէ' : 'Telegram sign-in unavailable')
    overlayRef.current.appendChild(script)

    return () => {
      delete window[CALLBACK_NAME]
      if (overlayRef.current) overlayRef.current.innerHTML = ''
    }
  }, [lang, referralCode])

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
      <button type="button" tabIndex={-1} aria-hidden="true" title="Telegram" style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--sand)', borderRadius: 10, background: '#fff', cursor: 'pointer', boxSizing: 'border-box',
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
