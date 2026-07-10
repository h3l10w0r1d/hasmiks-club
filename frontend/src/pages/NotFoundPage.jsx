import { Helmet } from 'react-helmet-async'
import { Compass } from 'lucide-react'
import GlobalHeader from '../components/GlobalHeader'

const copy = {
  en: { title: 'Page not found', body: "The page you're looking for doesn't exist or may have moved.", home: 'Back to home' },
  hy: { title: 'Էջը չի գտնվել', body: 'Դուք փնտրած էջը գոյություն չունի կամ տեղափոխվել է:', home: 'Վերադառնալ գլխավոր էջ' },
}

export default function NotFoundPage({ lang = 'en' }) {
  const t = copy[lang] ?? copy.en
  return (
    <div style={{ minHeight: '100vh', background: '#fff8f5', fontFamily: "'Jost', 'Noto Sans Armenian', 'Inter', sans-serif" }}>
      <Helmet><title>{t.title} — Hasmik's Club</title></Helmet>
      <GlobalHeader lang={lang} />
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '110px 20px', textAlign: 'center' }}>
        <Compass size={40} strokeWidth={1.4} color="var(--rose, #7E3434)" />
        <h1 style={{ fontFamily: "'Cormorant Garamond', 'Noto Sans Armenian', Georgia, serif", fontSize: 32, color: '#2c1a1a', margin: '16px 0 10px' }}>{t.title}</h1>
        <p style={{ color: '#786050', fontSize: 15, marginBottom: 28 }}>{t.body}</p>
        <a href="/" style={{ display: 'inline-block', padding: '13px 26px', borderRadius: 10, background: '#7E3434', color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
          {t.home}
        </a>
      </div>
    </div>
  )
}
