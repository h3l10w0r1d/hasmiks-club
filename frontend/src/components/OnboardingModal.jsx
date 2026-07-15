import { useState } from 'react'
import { Flower2, CalendarDays, BookOpen, MessageCircle, Send, PartyPopper } from 'lucide-react'
import { updateMe } from '../api/members'
import { useAuth } from '../context/AuthContext'

const STEPS = [
  {
    icon: Flower2,
    title: (lang) => lang === 'hy' ? 'Բարի գալուստ Hasmik\'s Club!' : 'Welcome to Hasmik\'s Club!',
    body:  (lang) => lang === 'hy'
      ? 'Դուք միացել եք Երևանի ամենաջերմ կանացի ակումբին: Ահա թե ինչ է սպասվում ձեզ:'
      : 'You\'ve joined the warmest women\'s club in Yerevan. Here\'s what awaits you:',
  },
  {
    icon: CalendarDays,
    title: (lang) => lang === 'hy' ? 'Հանդիպումներ և միջոցառումներ' : 'Gatherings & Events',
    body:  (lang) => lang === 'hy'
      ? 'Ամեն ամիս անցկացվում են հանդիպումներ, արհեստագործական սեմինարներ և մշակութային միջոցառումներ: RSVP-ն արագ կատարեք, քանի որ տեղերը սահմանափակ են:'
      : 'Monthly gatherings, craft ateliers, and cultural events. RSVP early — seats fill fast!',
  },
  {
    icon: BookOpen,
    title: (lang) => lang === 'hy' ? 'Բացառիկ բովանդակություն' : 'Exclusive Library',
    body:  (lang) => lang === 'hy'
      ? 'Ձեր անդամությունը բացում է բաղադրատոմսեր, eBook-ներ, և ռեսուրսներ, որոնք ստեղծվել են հատուկ ձեզ համար:'
      : 'Your membership unlocks recipes, ebooks, and curated resources created just for this club.',
  },
  {
    icon: MessageCircle,
    title: (lang) => lang === 'hy' ? 'Կապ Telegram-ի միջոցով' : 'Connect on Telegram',
    body:  (lang, telegramUrl) => lang === 'hy'
      ? 'Միացե՛ք մեր Telegram խմբին՝ ամենաթարմ նորություններն ու կապն ունենալու համար:'
      : 'Join our Telegram group to stay connected with the club and get the latest news.',
    isTelegram: true,
  },
]

export default function OnboardingModal({ lang, telegramUrl, onDone }) {
  const { setUser } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  const finish = async () => {
    setLoading(true)
    try {
      const updated = await updateMe({ onboarding_completed: true })
      setUser(u => ({ ...u, ...updated }))
    } catch { /* silently proceed */ }
    finally { setLoading(false) }
    onDone()
  }

  const handleNext = () => {
    if (isLast) finish()
    else setStep(s => s + 1)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(44,26,26,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, maxWidth: 440, width: '100%',
        padding: '40px 36px', textAlign: 'center', position: 'relative',
        boxShadow: '0 24px 80px rgba(44,26,26,0.25)',
        animation: 'dashFadeIn 0.25s ease both',
      }}>
        <button
          onClick={finish}
          disabled={loading}
          style={{
            position: 'absolute', top: 18, right: 18,
            background: 'none', border: 'none', color: '#786050',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '6px 8px',
          }}
        >
          {lang === 'hy' ? 'Բաց թողնել' : 'Skip'}
        </button>

        {/* step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i === step ? 'var(--rose)' : i < step ? 'var(--rose-lt)' : '#e5e7eb',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        <div style={{
          width: 64, height: 64, margin: '0 auto 20px',
          borderRadius: '50%', background: 'var(--rose-bg)', color: 'var(--rose)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <current.icon size={28} strokeWidth={1.75} />
        </div>
        <h2 style={{ fontFamily: '"Cormorant Garamond", "Noto Sans Armenian",serif', fontSize: 26, fontWeight: 700, color: 'var(--deep)', marginBottom: 14, lineHeight: 1.3 }}>
          {current.title(lang)}
        </h2>
        <p style={{ fontSize: 16, color: '#555', lineHeight: 1.7, marginBottom: 28 }}>
          {typeof current.body === 'function' ? current.body(lang, telegramUrl) : current.body}
        </p>

        {current.isTelegram && telegramUrl && (
          <a href={telegramUrl} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#0088cc', color: '#fff', borderRadius: 12, padding: '12px 0', fontWeight: 700, fontSize: 15, textDecoration: 'none', marginBottom: 16 }}>
            <Send size={16} /> {lang === 'hy' ? 'Միանալ Telegram-ին' : 'Join Telegram Group'}
          </a>
        )}

        <button
          onClick={handleNext}
          disabled={loading}
          style={{
            width: '100%', background: 'var(--rose)', color: '#fff',
            border: 'none', borderRadius: 12, padding: '14px 0',
            fontFamily: '"Jost", "Noto Sans Armenian",sans-serif', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', transition: 'opacity 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? '…' : isLast
            ? <>{lang === 'hy' ? 'Շնորհակալ եմ, ուրախ եմ!' : 'Let\'s go!'} <PartyPopper size={16} /></>
            : (lang === 'hy' ? 'Հաջորդ →' : 'Next →')
          }
        </button>

        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{ background: 'none', border: 'none', color: '#786050', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 12, padding: '6px 8px' }}>
            ← {lang === 'hy' ? 'Հետ' : 'Back'}
          </button>
        )}
      </div>
    </div>
  )
}
