import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Set right before a deliberate sign-out clears the token, so any request
// still in flight at that moment (dashboard/admin pages fire several on
// mount) doesn't have its resulting 401 force a hard redirect to /login
// over top of the sign-out flow's own navigate('/') — a genuinely expired
// session hit mid-browsing should still bounce to /login, just not this.
let justSignedOut = false
export function markSignedOut() {
  justSignedOut = true
  setTimeout(() => { justSignedOut = false }, 3000)
}

// Credential-exchange endpoints legitimately 401 on a bad/expired/stale
// credential (wrong password, a rejected Google ID token, etc.) without
// that having anything to do with whether the browser's EXISTING session
// (a separate, already-issued hc_token) is still valid. They don't send
// hc_token as the credential being checked, so a 401 here must not wipe
// it — without this, a stray login-form/Google-button re-render anywhere
// in the app that fires one of these calls in the background can log an
// otherwise-fully-authenticated user out of an unrelated page.
const AUTH_EXCHANGE_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/telegram']

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || ''
    const isAuthExchange = AUTH_EXCHANGE_PATHS.some((p) => url.includes(p))
    if (err.response?.status === 401 && !isAuthExchange) {
      localStorage.removeItem('hc_token')
      if (!justSignedOut) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
