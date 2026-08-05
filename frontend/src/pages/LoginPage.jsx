import { useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import GlobalHeader from '../components/GlobalHeader'
import AuthShell from '../components/AuthShell'
import LoginForm from '../components/LoginForm'

export default function LoginPage({ lang }) {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/dashboard'
  const title = lang === 'hy' ? 'Մուտք գործել' : 'Sign In'

  return (
    <>
    <Helmet defer={false}>
      <title>{`${title} — Hasmik's Club`}</title>
      <link rel="canonical" href="https://www.hasmiksclub.am/login" />
      <meta name="robots" content="noindex, follow" />
    </Helmet>
    <GlobalHeader lang={lang} />
    <AuthShell lang={lang} active="login">
      <LoginForm lang={lang} onSuccess={() => navigate(from, { replace: true })} />
    </AuthShell>
    </>
  )
}
