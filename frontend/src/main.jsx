import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// Error tracking — a no-op unless VITE_SENTRY_DSN is configured.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

// When a new deploy ships, the service worker installs a fresh cache in the
// background but won't take over an already-open tab on its own — reload
// once, automatically, the moment it does. Without this, visitors can keep
// seeing a stale cached version indefinitely after we push updates.
//
// The guard MUST survive the reload itself: window.location.reload() is a
// full page load, which re-runs this script from scratch and would reset a
// plain in-memory flag back to false — giving zero protection against a
// reload loop if controllerchange fires again afterwards. sessionStorage
// persists across reloads within the same tab, so this fires at most once
// per tab no matter how many times the event repeats.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('sw_reloaded')) return
    sessionStorage.setItem('sw_reloaded', '1')
    window.location.reload()
  })
}

function ErrorFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', padding: 24, fontFamily: 'Jost, sans-serif',
      background: '#F2E9DC', color: '#221C16',
    }}>
      <p style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian", serif', fontSize: 28, marginBottom: 12 }}>
        Something went wrong
      </p>
      <p style={{ fontSize: 15, color: '#7a6a63', marginBottom: 24, maxWidth: 360 }}>
        Please refresh the page. If this keeps happening, contact us and we'll help right away.
      </p>
      <button onClick={() => window.location.reload()} style={{
        background: '#7E3434', color: '#fff', border: 'none', borderRadius: 999,
        padding: '12px 32px', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', cursor: 'pointer',
      }}>
        Refresh
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
