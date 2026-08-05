import { createContext, useContext, useState, useCallback } from 'react'
import AuthModal from '../components/AuthModal'

const AuthModalContext = createContext(null)

// Mounted once at the app root (inside AppRoutes, so it has `lang`) — any
// component can call openLogin()/openRegister() to pop the auth card up
// over whatever page is currently showing, no navigation involved.
export function AuthModalProvider({ lang, children }) {
  const [mode, setMode] = useState(null) // null | 'login' | 'register'

  const openLogin = useCallback(() => setMode('login'), [])
  const openRegister = useCallback(() => setMode('register'), [])
  const close = useCallback(() => setMode(null), [])

  return (
    <AuthModalContext.Provider value={{ openLogin, openRegister }}>
      {children}
      {mode && <AuthModal lang={lang} mode={mode} onModeChange={setMode} onClose={close} />}
    </AuthModalContext.Provider>
  )
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider')
  return ctx
}
