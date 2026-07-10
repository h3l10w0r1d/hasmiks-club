import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Gift, Sparkles } from 'lucide-react'
import GlobalHeader from '../components/GlobalHeader'
import GoogleSignInButton from '../components/GoogleSignInButton'
import TelegramLoginButton from '../components/TelegramLoginButton'
import { useAuth } from '../context/AuthContext'
import { getGiftClaimInfo, claimGiftWithPassword, claimGiftApply } from '../api/gift'

const copy = {
  en: {
    pageTitle: "You've received a gift — Hasmik's Club",
    loading: 'Loading your gift…',
    notFound: 'This gift link doesn\'t seem to be valid.',
    alreadyClaimed: 'This gift has already been claimed.',
    goToLogin: 'Go to login',
    tapToOpen: 'Tap to open your gift',
    fromSomeone: 'Someone special has gifted you',
    fromNamed: name => `${name} has gifted you`,
    months: n => `${n} month${n === 1 ? '' : 's'} of membership`,
    claimHeading: name => `Welcome, ${name}!`,
    claimSub: 'Set a password to claim your gift, or continue with one tap:',
    passwordLabel: 'Choose a password',
    claimBtn: 'Claim my gift',
    claiming: 'Claiming…',
    or: 'or',
    genericError: 'Something went wrong — please try again.',
  },
  hy: {
    pageTitle: "Դուք նվեր եք ստացել — Hasmik's Club",
    loading: 'Ձեր նվերը բեռնվում է…',
    notFound: 'Այս նվերի հղումը վավեր չէ:',
    alreadyClaimed: 'Այս նվերն արդեն ստացվել է:',
    goToLogin: 'Անցնել մուտքի էջ',
    tapToOpen: 'Հպեք՝ նվերը բացելու համար',
    fromSomeone: 'Ինչ-որ մեկը ձեզ նվեր է արել',
    fromNamed: name => `${name}-ը ձեզ նվեր է արել`,
    months: n => `${n} ամիս անդամակցություն`,
    claimHeading: name => `Բարի գալուստ, ${name}!`,
    claimSub: 'Սահմանեք գաղտնաբառ՝ ձեր նվերը ստանալու համար, կամ շարունակեք մեկ հպումով.',
    passwordLabel: 'Ընտրեք գաղտնաբառ',
    claimBtn: 'Ստանալ իմ նվերը',
    claiming: 'Ստացվում է…',
    or: 'կամ',
    genericError: 'Ինչ-որ բան սխալ գնաց — խնդրում ենք կրկին փորձել:',
  },
}

export default function GiftClaimPage({ lang = 'en' }) {
  const t = copy[lang] ?? copy.en
  const { token } = useParams()
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [status, setStatus] = useState('loading') // loading | notFound | alreadyClaimed | closed | opening | open | claiming
  const [info, setInfo] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getGiftClaimInfo(token)
      .then(data => {
        setInfo(data)
        setStatus(data.already_redeemed ? 'alreadyClaimed' : 'closed')
      })
      .catch(() => setStatus('notFound'))
  }, [token])

  const handleOpen = () => {
    setStatus('opening')
    setTimeout(() => setStatus('open'), 900)
  }

  const finishClaim = (data) => {
    signIn(data)
    navigate('/welcome')
  }

  const handlePasswordClaim = async (e) => {
    e.preventDefault()
    setError('')
    setStatus('claiming')
    try {
      const data = await claimGiftWithPassword(token, password)
      finishClaim(data)
    } catch (err) {
      setStatus('open')
      setError(err?.response?.data?.detail || t.genericError)
    }
  }

  const handleSocialSuccess = async (data) => {
    setError('')
    setStatus('claiming')
    try {
      signIn(data)
      const applied = await claimGiftApply(token)
      finishClaim(applied)
    } catch (err) {
      setStatus('open')
      setError(err?.response?.data?.detail || t.genericError)
    }
  }

  const fromLine = info?.giver_name ? t.fromNamed(info.giver_name) : t.fromSomeone

  return (
    <div style={styles.page}>
      <Helmet><title>{t.pageTitle}</title></Helmet>
      <GlobalHeader lang={lang} />

      <style>{keyframesCss}</style>

      <div style={styles.container}>
        {status === 'loading' && <p style={styles.dim}>{t.loading}</p>}

        {status === 'notFound' && (
          <div style={styles.card}>
            <p style={{ fontSize: 16, color: '#7E3434', textAlign: 'center' }}>{t.notFound}</p>
          </div>
        )}

        {status === 'alreadyClaimed' && (
          <div style={styles.card}>
            <p style={{ fontSize: 16, color: '#180C04', textAlign: 'center', marginBottom: 20 }}>{t.alreadyClaimed}</p>
            <a href="/login" style={styles.btnPrimaryLink}>{t.goToLogin}</a>
          </div>
        )}

        {(status === 'closed' || status === 'opening') && info && (
          <div style={styles.giftBoxWrap}>
            <button
              onClick={handleOpen}
              disabled={status === 'opening'}
              style={{ ...styles.giftBoxBtn, animation: status === 'opening' ? 'giftPop 0.5s ease forwards' : 'giftFloat 2.4s ease-in-out infinite' }}
              aria-label={t.tapToOpen}
            >
              <Gift size={72} strokeWidth={1.3} color="#7E3434" />
            </button>
            {status === 'opening' && (
              <div style={styles.confettiWrap}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      ...styles.confettiDot,
                      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                      left: '50%', top: '50%',
                      animation: `confettiBurst${i % 4} 0.9s ease-out forwards`,
                      animationDelay: `${(i % 5) * 0.02}s`,
                    }}
                  />
                ))}
              </div>
            )}
            {status === 'closed' && <p style={styles.tapHint}>{t.tapToOpen}</p>}
          </div>
        )}

        {(status === 'open' || status === 'claiming') && info && (
          <div style={{ ...styles.card, animation: 'cardIn 0.5s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <Sparkles size={28} color="#C47A72" style={{ marginBottom: 8 }} />
              <p style={styles.cardTitle}>{t.claimHeading(info.recipient_name)}</p>
              <p style={{ fontSize: 14, color: '#786050', margin: '6px 0 0' }}>{fromLine}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#7E3434', margin: '10px 0 0' }}>{t.months(info.duration_months)}</p>
            </div>

            <p style={{ fontSize: 14, color: '#786050', textAlign: 'center', marginBottom: 18 }}>{t.claimSub}</p>

            <form onSubmit={handlePasswordClaim} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={styles.label}>
                {t.passwordLabel}
                <input
                  required type="password" minLength={8} value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={styles.input}
                />
              </label>
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" disabled={status === 'claiming'} style={{ ...styles.btnPrimary, opacity: status === 'claiming' ? 0.7 : 1 }}>
                {status === 'claiming' ? t.claiming : t.claimBtn}
              </button>
            </form>

            <div style={styles.divider}><span>{t.or}</span></div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <GoogleSignInButton lang={lang} onSuccess={handleSocialSuccess} onError={setError} />
              <TelegramLoginButton lang={lang} onSuccess={handleSocialSuccess} onError={setError} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const CONFETTI_COLORS = ['#7E3434', '#C47A72', '#DDD0BA', '#A85C5A']

const keyframesCss = `
@keyframes giftFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes giftPop { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(0); opacity: 0; } }
@keyframes cardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes confettiBurst0 { from { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; } to { transform: translate(-50%,-50%) translate(-70px,-90px) scale(0); opacity: 0; } }
@keyframes confettiBurst1 { from { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; } to { transform: translate(-50%,-50%) translate(80px,-70px) scale(0); opacity: 0; } }
@keyframes confettiBurst2 { from { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; } to { transform: translate(-50%,-50%) translate(-60px,80px) scale(0); opacity: 0; } }
@keyframes confettiBurst3 { from { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; } to { transform: translate(-50%,-50%) translate(70px,90px) scale(0); opacity: 0; } }
`

const styles = {
  page: { minHeight: '100vh', background: '#fff8f5', fontFamily: "'Jost', 'Noto Sans Armenian', 'Inter', sans-serif" },
  container: { maxWidth: 460, margin: '0 auto', padding: '80px 20px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  dim: { color: '#786050', fontSize: 16 },
  card: { background: '#fff', borderRadius: 20, padding: '32px 28px', boxShadow: '0 4px 24px rgba(126,52,52,.1)', width: '100%', boxSizing: 'border-box' },
  cardTitle: { fontSize: 22, fontWeight: 700, color: '#180C04', margin: 0, fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif" },
  giftBoxWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, position: 'relative' },
  giftBoxBtn: { width: 140, height: 140, borderRadius: '50%', background: '#fff', border: '2px solid #EEDFD3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 30px rgba(126,52,52,.12)' },
  confettiWrap: { position: 'absolute', top: 70, left: '50%', width: 0, height: 0 },
  confettiDot: { position: 'absolute', width: 8, height: 8, borderRadius: '50%' },
  tapHint: { fontSize: 14, color: '#786050', fontWeight: 500 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#786050' },
  input: { border: '1px solid #DDD0BA', borderRadius: 8, padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', color: '#180C04' },
  error: { fontSize: 14, color: '#7E3434', fontWeight: 500, margin: 0 },
  btnPrimary: { padding: '14px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#7E3434', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', minHeight: 48 },
  btnPrimaryLink: { display: 'block', textAlign: 'center', padding: '14px 20px', borderRadius: 10, background: '#7E3434', color: '#fff', fontSize: 16, fontWeight: 700, textDecoration: 'none' },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: '#A99B8A', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' },
}
