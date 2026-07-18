import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Heart, HeartHandshake, Coffee, Compass } from 'lucide-react'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'
import InstagramEmbed from '../components/InstagramEmbed'
import { useContent } from '../context/SiteContentContext'

// One icon per section, same order/meaning in both languages.
const SECTION_ICONS = [Heart, HeartHandshake, Coffee, Compass]

export default function AboutPage({ lang = 'en', setLang }) {
  const t = useContent()
  const a = t.about
  const hy = lang === 'hy'
  const L = (base) => (hy ? a[`${base}Hy`] : a[`${base}En`])
  const c = {
    metaTitle: L('metaTitle'),
    metaDesc: L('metaDesc'),
    eyebrow: L('eyebrow'),
    ctaText: L('ctaText'),
    cta: L('cta'),
    sections: [1, 2, 3, 4].map((i) => ({
      h: L(`s${i}h`),
      p: hy ? a[`s${i}pHy`] : a[`s${i}pEn`],
      reel: a[`s${i}reel`],
    })),
  }
  return (
    <div className="page-shell">
      <Helmet>
        <title>{c.metaTitle}</title>
        <meta name="description" content={c.metaDesc} />
        <link rel="canonical" href="https://www.hasmiksclub.am/about" />
      </Helmet>
      <GlobalHeader lang={lang} setLang={setLang} />

      <main className="page-main">
        <header className="page-hero">
          <h1 className="page-title">{c.eyebrow}</h1>
        </header>

        <div className="page-body about-body">
          {c.sections.map((s, i) => {
            const Icon = SECTION_ICONS[i]
            return (
              <div className={`story-feature${i % 2 === 1 ? ' story-feature--reverse' : ''}`} key={i}>
                <section className="page-section--card">
                  <div className="card-icon"><Icon size={22} /></div>
                  <h2>{s.h}</h2>
                  {s.p?.map((para, j) => <p key={j}>{para}</p>)}
                  {s.list && (
                    <ul>{s.list.map((li, j) => <li key={j}>{li}</li>)}</ul>
                  )}
                </section>
                <div className="story-feature-media">
                  <InstagramEmbed url={s.reel} />
                </div>
              </div>
            )
          })}

          <section className="page-section page-section--card page-section--center">
            <h2>{c.ctaText}</h2>
            <Link to="/register" className="page-cta">{c.cta}</Link>
          </section>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
