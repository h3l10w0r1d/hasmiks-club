import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'
import { useContent } from '../context/SiteContentContext'
import { E, installEditGuards } from '../components/Editable'

export default function TermsPage({ lang = 'en', setLang }) {
  useEffect(() => { installEditGuards() }, [])
  const t = useContent()
  const a = t.terms
  const hy = lang === 'hy'
  const sfx = hy ? 'Hy' : 'En'
  const L = (base) => a[`${base}${sfx}`]
  const c = {
    metaTitle: L('metaTitle'), metaDesc: L('metaDesc'),
    eyebrow: L('eyebrow'), title: L('title'), updated: L('updated'), intro: L('intro'),
    sections: a.sections.map((s) => ({ h: hy ? s.hHy : s.hEn, p: hy ? s.pHy : s.pEn })),
  }
  return (
    <div className="page-shell">
      <Helmet>
        <title>{c.metaTitle}</title>
        <meta name="description" content={c.metaDesc} />
        <link rel="canonical" href="https://www.hasmiksclub.am/terms" />
      </Helmet>
      <GlobalHeader lang={lang} setLang={setLang} />

      <main className="page-main">
        <header className="page-hero">
          <E as="div" className="page-eyebrow" path={`terms.eyebrow${sfx}`} value={c.eyebrow} />
          <E as="h1" className="page-title" path={`terms.title${sfx}`} value={c.title} />
          <E as="p" className="page-updated" path={`terms.updated${sfx}`} value={c.updated} />
        </header>

        <div className="page-body">
          <section className="page-section">
            <E as="p" path={`terms.intro${sfx}`} value={c.intro} />
          </section>
          {c.sections.map((s, i) => (
            <section className="page-section" key={i}>
              <E as="h2" path={`terms.sections.${i}.h${sfx}`} value={s.h} />
              {s.p.map((para, j) => (
                <E as="p" key={j} path={`terms.sections.${i}.p${sfx}`} value={para} listIndex={j} />
              ))}
            </section>
          ))}
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
