import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
