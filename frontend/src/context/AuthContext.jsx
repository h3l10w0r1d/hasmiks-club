import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getMe } from '../api/members'
import { refreshToken } from '../api/auth'
import { markSignedOut } from '../api/client'

const AuthContext = createContext(null)

function parseJwtExp(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshTimerRef = useRef(null)
  // Read by ProtectedRoute/AdminRoute: a ref (not state) so setting it never
  // itself triggers a render — it only needs to be current by the time the
  // route guards re-render in response to `user` going null right below.
  const signingOutRef = useRef(false)

  const silentRefresh = useCallback(async (token) => {
    const exp = parseJwtExp(token)
    if (!exp) return
    const msUntilExpiry = exp - Date.now()
    if (msUntilExpiry <= 0) return // already expired — the 401 interceptor handles redirect on next request

    // Refresh partway through the token's remaining lifetime, capped at 1 day
    // ahead for long-lived tokens. A fixed 24h buffer subtracted from a token
    // whose ACCESS_TOKEN_EXPIRE_MINUTES is configured under 24h would compute
    // 0ms here — firing an immediate refresh that mints a new token with the
    // same short lifetime, immediately refreshing again, forever. The 30s
    // floor guarantees this can never tighten into a rapid loop regardless of
    // how short the configured token lifetime is.
    const buffer = Math.min(86400000, msUntilExpiry / 2)
    // setTimeout delays are stored as a 32-bit signed int; anything past ~24.8
    // days (2^31-1 ms) overflows and fires immediately instead of waiting —
    // which, since each fire re-mints a same-lifetime token and reschedules
    // itself, would hammer /auth/refresh in a tight infinite loop. With
    // ACCESS_TOKEN_EXPIRE_MINUTES at 90 days that overflow is guaranteed, so
    // cap the actual wait well under the limit; the token itself still lasts
    // its full configured lifetime, this just re-arms the timer periodically.
    const MAX_TIMEOUT_MS = 20 * 86400000 // 20 days
    const refreshIn = Math.min(Math.max(msUntilExpiry - buffer, 30000), MAX_TIMEOUT_MS)
    refreshTimerRef.current = setTimeout(async () => {
      // Bail out if user already signed out (token gone)
      if (!localStorage.getItem('hc_token')) return
      try {
        const data = await refreshToken()
        localStorage.setItem('hc_token', data.access_token)
        setUser(data.user)
        silentRefresh(data.access_token)
      } catch {
        // token truly expired — 401 interceptor handles redirect
      }
    }, refreshIn)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('hc_token')
    if (token) {
      getMe()
        .then((u) => {
          setUser(u)
          silentRefresh(token)
        })
        .catch(() => localStorage.removeItem('hc_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [silentRefresh])

  const signIn = (tokenData) => {
    signingOutRef.current = false
    localStorage.setItem('hc_token', tokenData.access_token)
    setUser(tokenData.user)
    silentRefresh(tokenData.access_token)
  }

  const signOut = () => {
    // Cancel any pending silent-refresh so it can't put the token back
    clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = null
    markSignedOut()
    // ProtectedRoute/AdminRoute normally redirect to /login the instant
    // `user` goes null — right, for an expired/missing session, but wrong
    // for a deliberate sign-out, which already navigates to / itself. This
    // flag tells those guards to stand down for this one transition, then
    // clears itself — a later direct visit to /dashboard while genuinely
    // signed out must still bounce to /login, not silently render nothing.
    signingOutRef.current = true
    setTimeout(() => { signingOutRef.current = false }, 2000)
    localStorage.removeItem('hc_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, signIn, signOut, loading, signingOutRef }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
