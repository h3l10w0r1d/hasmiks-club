import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'
import { useContent } from '../context/SiteContentContext'
import { E, installEditGuards, AddItemButton, RemoveItemButton } from '../components/Editable'

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
            <E as="p" path={`terms.intro${sfx}`} value={c.intro} emphasis />
          </section>
          {c.sections.map((s, i) => (
            <section className="page-section" key={i}>
              <E as="h2" path={`terms.sections.${i}.h${sfx}`} value={s.h} emphasis />
              {s.p.map((para, j) => (
                <div className="hc-item-row" key={j}>
                  <E as="p" path={`terms.sections.${i}.p${sfx}`} value={para} listIndex={j} emphasis />
                  {s.p.length > 1 && <RemoveItemButton paths={[`terms.sections.${i}.p${sfx}`]} index={j} />}
                </div>
              ))}
              <AddItemButton paths={[`terms.sections.${i}.p${sfx}`]} label={hy ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />
            </section>
          ))}
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
