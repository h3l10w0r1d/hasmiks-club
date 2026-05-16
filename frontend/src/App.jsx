import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useLang } from './hooks/useLang'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Band from './components/Band'
import Why from './components/Why'
import What from './components/What'
import Story from './components/Story'
import Pricing from './components/Pricing'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'

function LandingPage({ lang, setLang }) {
  return (
    <>
      <Nav lang={lang} setLang={setLang} />
      <Hero lang={lang} />
      <Band lang={lang} />
      <Why lang={lang} />
      <What lang={lang} />
      <Story lang={lang} />
      <Pricing lang={lang} />
      <FinalCta lang={lang} />
      <Footer />
    </>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const [lang, setLang] = useLang()
  return (
    <Routes>
      <Route path="/" element={<LandingPage lang={lang} setLang={setLang} />} />
      <Route path="/login" element={<LoginPage lang={lang} />} />
      <Route path="/register" element={<RegisterPage lang={lang} />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage lang={lang} />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <AdminRoute>
          <AdminPage />
        </AdminRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
