import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SiteContentProvider, useContent } from './context/SiteContentContext'
import { DEFAULT_LAYOUT, normalizeLayout } from './data/landingSections'
import { useLang } from './hooks/useLang'
import { useLandingAnimations } from './hooks/useLandingAnimations'
import GlobalHeader from './components/GlobalHeader'
import Hero from './components/Hero'
import Community from './components/Community'
import Story from './components/Story'
import Pricing from './components/Pricing'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'
import GuestScanPage from './pages/GuestScanPage'
import AdminMemberDetailPage from './pages/AdminMemberDetailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Band from './components/Band'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import WelcomePage from './pages/WelcomePage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import TermsPage from './pages/TermsPage'
import GiftPage from './pages/GiftPage'
import GiftClaimPage from './pages/GiftClaimPage'
import NotFoundPage from './pages/NotFoundPage'

const SITE_URL = 'https://www.hasmiksclub.am'
const OG_IMAGE = `${SITE_URL}/og-image.jpg`

const SECTION_COMPONENTS = { hero: Hero, band: Band, community: Community, story: Story, pricing: Pricing, finalCta: FinalCta }

function LandingPage({ lang, setLang }) {
  useLandingAnimations()
  const content = useContent()
  const layout = normalizeLayout(content.__layout ?? DEFAULT_LAYOUT)
  const title = lang === 'hy' ? "Hasmik's Club — Կանանց ակումբ Երևանում" : "Hasmik's Club — A Women's Club in Yerevan"
  const description = lang === 'hy'
    ? 'Hasmik\'s Club-ը Երևանի կանանց մշակութային ակումբ է: Դասընթացներ, հանդիպումներ, և ընտանեկան մթնոլորտ:'
    : "Hasmik's Club is a curated women's club in Yerevan — intimate gatherings, cultural events, and a circle of like-minded women."
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
      {layout.filter((s) => s.enabled).map((s) => {
        const Section = SECTION_COMPONENTS[s.id]
        return Section ? <Section key={s.id} lang={lang} /> : null
      })}
      <Footer lang={lang} />
    </>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

// Inverse of ProtectedRoute: while a JWT is still valid, send the user straight
// to their dashboard instead of showing the marketing landing/login/register pages.
function GuestOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
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
      <Route path="/" element={
        <GuestOnlyRoute>
          <LandingPage lang={lang} setLang={setLang} />
        </GuestOnlyRoute>
      } />
      {/* Ungated render of the landing page for the admin Site Editor's live
          preview iframe (loaded as /preview?preview=1) — never redirects. */}
      <Route path="/preview" element={<LandingPage lang={lang} setLang={setLang} />} />
      <Route path="/login" element={
        <GuestOnlyRoute>
          <LoginPage lang={lang} />
        </GuestOnlyRoute>
      } />
      <Route path="/register" element={
        <GuestOnlyRoute>
          <RegisterPage lang={lang} />
        </GuestOnlyRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage lang={lang} setLang={setLang} />
        </ProtectedRoute>
      } />
      <Route path="/welcome" element={
        <ProtectedRoute>
          <WelcomePage lang={lang} setLang={setLang} />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <AdminRoute>
          <AdminPage />
        </AdminRoute>
      } />
      <Route path="/admin/scan" element={
        <AdminRoute>
          <GuestScanPage />
        </AdminRoute>
      } />
      <Route path="/admin/members/:id" element={
        <AdminRoute>
          <AdminMemberDetailPage />
        </AdminRoute>
      } />
      <Route path="/forgot-password" element={<ForgotPasswordPage lang={lang} />} />
      <Route path="/reset-password" element={<ResetPasswordPage lang={lang} />} />
      <Route path="/events" element={<EventsPage lang={lang} />} />
      <Route path="/events/:id" element={<EventDetailPage lang={lang} />} />
      <Route path="/about" element={<AboutPage lang={lang} setLang={setLang} />} />
      <Route path="/contact" element={<ContactPage lang={lang} setLang={setLang} />} />
      <Route path="/terms" element={<TermsPage lang={lang} setLang={setLang} />} />
      <Route path="/gift" element={<GiftPage lang={lang} />} />
      <Route path="/gift/claim/:token" element={<GiftClaimPage lang={lang} />} />
      <Route path="*" element={<NotFoundPage lang={lang} />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SiteContentProvider>
          <AppRoutes />
        </SiteContentProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
