import { useEffect, useRef, useState } from 'react'
import { linkTelegram } from '../api/members'
import { TelegramIcon } from './SocialIcons'

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
const CALLBACK_NAME = '__hasmiksTelegramLink'

/**
 * "Connect Telegram" pill for an already-logged-in member's profile — distinct
 * from TelegramLoginButton (used on Login/Register to sign in / create an
 * account). Same overlay technique: Telegram's real widget is invisible and
 * sized to cover this pill, so the click still goes to Telegram; the payload
 * is then sent to POST /members/me/telegram, which verifies it server-side
 * and attaches it to the current account (never auto-creates one here).
 */
export default function TelegramLinkButton({ lang = 'en', onSuccess, onError }) {
  const overlayRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!BOT_USERNAME || !overlayRef.current) return
    setReady(false)

    window[CALLBACK_NAME] = async (telegramUser) => {
      setBusy(true)
      try {
        const updated = await linkTelegram(telegramUser)
        onSuccess?.(updated)
      } catch (err) {
        onError?.(err?.response?.data?.detail || (lang === 'hy' ? 'Telegram-ը կապակցել չհաջողվեց' : 'Could not connect Telegram'))
      } finally {
        setBusy(false)
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
    script.onerror = () => onError?.(lang === 'hy' ? 'Telegram-ը հասանելի չէ' : 'Telegram unavailable')
    overlayRef.current.appendChild(script)

    return () => {
      delete window[CALLBACK_NAME]
      if (overlayRef.current) overlayRef.current.innerHTML = ''
    }
  }, [lang])

  if (!BOT_USERNAME) return null

  return (
    <div style={{ position: 'relative', display: 'inline-block', minHeight: 40 }}>
      <button type="button" tabIndex={-1} aria-hidden="true" disabled={busy} style={{
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 40,
        padding: '0 16px', border: '1px solid var(--sand)', borderRadius: 8,
        background: '#fff', color: 'var(--deep)', fontSize: 13, fontWeight: 600,
        fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.6 : 1,
      }}>
        <TelegramIcon size={17} />
        {busy ? (lang === 'hy' ? '...' : '…') : (lang === 'hy' ? 'Կապակցել Telegram-ը' : 'Connect Telegram')}
      </button>
      <div ref={overlayRef} style={{
        position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: ready && !busy ? 'auto' : 'none',
      }} />
    </div>
  )
}
