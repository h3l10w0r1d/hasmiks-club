import { createContext, useContext, useState, useEffect, useCallback } from 'react'
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

  const silentRefresh = useCallback(async (token) => {
    const exp = parseJwtExp(token)
    if (!exp) return
    const msUntilExpiry = exp - Date.now()
    // If less than 1 day left, refresh now; otherwise schedule refresh 1 day before expiry
    const refreshIn = Math.max(msUntilExpiry - 86400000, 0)
    setTimeout(async () => {
      try {
        const data = await refreshToken()
        localStorage.setItem('hc_token', data.access_token)
        setUser(data.user)
        silentRefresh(data.access_token)
      } catch {
        // token truly expired, let 401 interceptor handle logout
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
