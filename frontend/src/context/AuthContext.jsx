import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../api/members'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('hc_token')
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => localStorage.removeItem('hc_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const signIn = (tokenData) => {
    localStorage.setItem('hc_token', tokenData.access_token)
    setUser(tokenData.user)
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
