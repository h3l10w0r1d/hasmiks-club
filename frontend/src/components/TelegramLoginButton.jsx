import { useEffect, useRef, useState } from 'react'
import { telegramSignIn } from '../api/auth'
import { TelegramIcon } from './SocialIcons'

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
const CALLBACK_NAME = '__hasmiksTelegramAuth'
const BTN_WIDTH = 340
const BTN_HEIGHT = 44

/**
 * A brand-consistent "Continue with Telegram" button. Telegram's own login
 * widget (their documented script-tag integration) is kept but made
 * invisible and centered on top of our custom-styled button — same overlay
 * technique as GoogleSignInButton, so the real click still lands on
 * Telegram's widget. On success, sends the widget's signed payload to the
 * backend, which verifies it server-side (Telegram never exposes a
 * client-side verification API) and either logs into an existing
 * telegram-linked account or creates a new one — Telegram provides no
 * email, so there is no auto-link-by-email path here like with Google.
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
    script.setAttribute('data-size', 'large')
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
    <div style={{ position: 'relative', width: '100%', maxWidth: BTN_WIDTH, height: BTN_HEIGHT, margin: '0 auto' }}>
      <button type="button" tabIndex={-1} aria-hidden="true" style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        border: '1px solid var(--sand)', borderRadius: 8, background: '#fff', color: 'var(--deep)',
        fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxSizing: 'border-box',
      }}>
        <TelegramIcon size={18} /> {lang === 'hy' ? 'Շարունակել Telegram-ով' : 'Continue with Telegram'}
      </button>
      <div ref={overlayRef} style={{
        position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: ready ? 'auto' : 'none',
      }} />
    </div>
  )
}
