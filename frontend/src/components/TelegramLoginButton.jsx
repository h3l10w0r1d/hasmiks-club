import { useEffect, useRef } from 'react'
import { telegramSignIn } from '../api/auth'

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
const CALLBACK_NAME = '__hasmiksTelegramAuth'

/**
 * Renders Telegram's own login widget (their documented script-tag integration —
 * same "platform-owned button" approach as GoogleSignInButton). On success, sends
 * the widget's signed payload to the backend, which verifies it server-side
 * (Telegram never exposes a client-side verification API) and either logs into
 * an existing telegram-linked account or creates a new one — Telegram provides
 * no email, so there is no auto-link-by-email path here like with Google.
 */
export default function TelegramLoginButton({ lang = 'en', referralCode, onSuccess, onError }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!BOT_USERNAME || !containerRef.current) return

    window[CALLBACK_NAME] = async (telegramUser) => {
      try {
        const data = await telegramSignIn(telegramUser, referralCode)
        onSuccess?.(data)
      } catch {
        onError?.(lang === 'hy' ? 'Telegram մուտքը ձախողվեց' : 'Telegram sign-in failed')
      }
    }

    containerRef.current.innerHTML = ''
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-onauth', `${CALLBACK_NAME}(user)`)
    script.onerror = () => onError?.(lang === 'hy' ? 'Telegram մուտքը հասանելի չէ' : 'Telegram sign-in unavailable')
    containerRef.current.appendChild(script)

    return () => {
      delete window[CALLBACK_NAME]
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [lang, referralCode])

  if (!BOT_USERNAME) return null

  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
}
