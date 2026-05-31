import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getMe } from '../api/members'
import { refreshToken } from '../api/auth'

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

  const silentRefresh = useCallback(async (token) => {
    const exp = parseJwtExp(token)
    if (!exp) return
    const msUntilExpiry = exp - Date.now()
    // Schedule refresh 1 day before expiry; if already within 1 day, refresh now
    const refreshIn = Math.max(msUntilExpiry - 86400000, 0)
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
    localStorage.setItem('hc_token', tokenData.access_token)
    setUser(tokenData.user)
    silentRefresh(tokenData.access_token)
  }

  const signOut = () => {
    // Cancel any pending silent-refresh so it can't put the token back
    clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = null
    localStorage.removeItem('hc_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
