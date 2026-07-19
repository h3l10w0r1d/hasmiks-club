import './App.css'
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SiteContentProvider, useContent, EDIT_ACTION_MSG } from './context/SiteContentContext'
import { DEFAULT_LAYOUT, SECTION_LABEL, BLOCK_TEMPLATE_LABEL, isCustomBlockId, normalizeLayout } from './data/landingSections'
import { normalizePageLayout } from './data/sitePages'
import BlockFrame from './components/BlockFrame'
import CustomBlock from './components/CustomBlock'
import { installEditGuards } from './components/Editable'
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

const IS_EDIT = (() => {
  try { return new URLSearchParams(window.location.search).get('edit') === '1' } catch { return false }
})()

function LandingPage({ lang, setLang }) {
  useLandingAnimations()
  const content = useContent()
  const layout = normalizeLayout(content.__layout ?? DEFAULT_LAYOUT)

  // On-canvas editing: keep links inert so clicking to edit never navigates.
  useEffect(() => { if (IS_EDIT) installEditGuards() }, [])

  const blockAction = (id, action, payload) => {
    try { window.parent?.postMessage({ type: EDIT_ACTION_MSG, id, action, ...payload }, window.location.origin) } catch { /* noop */ }
  }
  const sfx = lang === 'hy' ? 'Hy' : 'En'
  const title = content.landingMeta[`metaTitle${sfx}`]
  const description = content.landingMeta[`metaDesc${sfx}`]
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
      {(() => {
        const enabled = layout.filter((s) => s.enabled)
        return enabled.map((s, i) => {
          const isCustom = isCustomBlockId(s.id)
          const Section = SECTION_COMPONENTS[s.id]
          if (!isCustom && !Section) return null
          const node = isCustom
            ? <CustomBlock key={s.id} id={s.id} type={s.type} lang={lang} />
            : <Section key={s.id} lang={lang} />
          if (!IS_EDIT) return node
          const label = isCustom ? (BLOCK_TEMPLATE_LABEL[s.type] ?? 'Block') : (SECTION_LABEL[s.id] ?? s.id)
          const cb = isCustom ? (content.custom?.[s.id] || {}) : null
          return (
            <BlockFrame
              key={s.id}
              id={s.id}
              label={label}
              canUp={i > 0}
              canDown={i < enabled.length - 1}
              onAction={blockAction}
              isCustom={isCustom}
              bg={cb?.bg}
              spacing={cb?.spacing}
            >
              {node}
            </BlockFrame>
          )
        })
      })()}
      <Footer lang={lang} />
    </>
  )
}

// Renders an admin-created page (beyond the fixed landing/about/contact/
// events/terms set) at /p/:slug. A blank canvas of custom blocks — same
// rendering/editing machinery as the landing page's custom blocks, just
// without the fixed designed sections (Hero, Story, etc.).
function CustomPage({ lang, setLang }) {
  const { slug } = useParams()
  const content = useContent()
  const pages = Array.isArray(content.__pages) ? content.__pages : []
  const pageDef = pages.find((pg) => pg.slug === slug)

  useEffect(() => { if (IS_EDIT) installEditGuards() }, [])

  if (!pageDef) return <NotFoundPage lang={lang} />

  const sfx = lang === 'hy' ? 'Hy' : 'En'
  const pageContent = content.page?.[pageDef.id] || {}
  const layout = normalizePageLayout(pageContent.__layout)
  const fallbackTitle = lang === 'hy' ? pageDef.titleHy : pageDef.titleEn
  const title = pageContent[`metaTitle${sfx}`] || fallbackTitle
  const description = pageContent[`metaDesc${sfx}`] || ''

  const blockAction = (id, action, payload) => {
    try { window.parent?.postMessage({ type: EDIT_ACTION_MSG, id, action, ...payload }, window.location.origin) } catch { /* noop */ }
  }

  return (
    <>
      <Helmet>
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
      </Helmet>
      <GlobalHeader lang={lang} setLang={setLang} />
      {layout.filter((s) => s.enabled).map((s, i, enabled) => {
        const node = <CustomBlock key={s.id} id={s.id} type={s.type} lang={lang} />
        if (!IS_EDIT) return node
        return (
          <BlockFrame
            key={s.id}
            id={s.id}
            label={BLOCK_TEMPLATE_LABEL[s.type] ?? 'Block'}
            canUp={i > 0}
            canDown={i < enabled.length - 1}
            onAction={blockAction}
            isCustom
            bg={content.custom?.[s.id]?.bg}
            spacing={content.custom?.[s.id]?.spacing}
          >
            {node}
          </BlockFrame>
        )
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
      <Route path="/p/:slug" element={<CustomPage lang={lang} setLang={setLang} />} />
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
