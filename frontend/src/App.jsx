import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useLang } from './hooks/useLang'
import GlobalHeader from './components/GlobalHeader'
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
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import EventsPage from './pages/EventsPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import TermsPage from './pages/TermsPage'

const SITE_URL = 'https://www.hasmiksclub.am'
const OG_IMAGE = `${SITE_URL}/og-image.jpg`

function LandingPage({ lang, setLang }) {
  const title = lang === 'hy' ? "Hasmik's Club — Կանանց համայնք Երևանում" : "Hasmik's Club — A Women's Circle in Yerevan"
  const description = lang === 'hy'
    ? 'Hasmik\'s Club-ը Երևանի կանանց մշակութային ակումբ է: Դասընթացներ, հանդիպումներ, և ընտանեկան մթնոլորտ:'
    : "Hasmik's Club is a curated women's community in Yerevan — intimate gatherings, cultural events, and a circle of like-minded women."
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={SITE_URL} />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:locale" content={lang === 'hy' ? 'hy_AM' : 'en_US'} />
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={OG_IMAGE} />
      </Helmet>
      <GlobalHeader lang={lang} setLang={setLang} />
      <Hero lang={lang} />
      <Band lang={lang} />
      <Why lang={lang} />
      <What lang={lang} />
      <Story lang={lang} />
      <Pricing lang={lang} />
      <FinalCta lang={lang} />
      <Footer lang={lang} />
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
      <Route path="/forgot-password" element={<ForgotPasswordPage lang={lang} />} />
      <Route path="/reset-password" element={<ResetPasswordPage lang={lang} />} />
      <Route path="/events" element={<EventsPage lang={lang} />} />
      <Route path="/about" element={<AboutPage lang={lang} setLang={setLang} />} />
      <Route path="/contact" element={<ContactPage lang={lang} setLang={setLang} />} />
      <Route path="/terms" element={<TermsPage lang={lang} setLang={setLang} />} />
      <Route path="/verify-email" element={<ResetPasswordPage lang={lang} />} />
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
