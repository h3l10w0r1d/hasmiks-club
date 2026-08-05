import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import GlobalHeader from '../components/GlobalHeader'
import AuthShell from '../components/AuthShell'
import RegisterForm from '../components/RegisterForm'

export default function RegisterPage({ lang }) {
  const navigate = useNavigate()
  const title = lang === 'hy' ? 'Միանալ ակումբին' : 'Join the Club'

  return (
    <>
    <Helmet defer={false}>
      <title>{`${title} — Hasmik's Club`}</title>
      <link rel="canonical" href="https://www.hasmiksclub.am/register" />
    </Helmet>
    <GlobalHeader lang={lang} />
    <AuthShell lang={lang} active="register">
      <RegisterForm lang={lang} onSuccess={() => navigate('/dashboard')} />
    </AuthShell>
    </>
  )
}
