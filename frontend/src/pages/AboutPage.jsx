import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Heart, HeartHandshake, Coffee, Compass } from 'lucide-react'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'
import InstagramEmbed from '../components/InstagramEmbed'
import { useContent } from '../context/SiteContentContext'
import { E, EditableReel, installEditGuards, AddItemButton, RemoveItemButton } from '../components/Editable'

// One icon per section, same order/meaning in both languages.
const SECTION_ICONS = [Heart, HeartHandshake, Coffee, Compass]

export default function AboutPage({ lang = 'en', setLang }) {
  useEffect(() => { installEditGuards() }, [])
  const t = useContent()
  const a = t.about
  const hy = lang === 'hy'
  const sfx = hy ? 'Hy' : 'En'
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
          <E as="h1" className="page-title" path={`about.eyebrow${sfx}`} value={c.eyebrow} />
        </header>

        <div className="page-body about-body">
          {c.sections.map((s, i) => {
            const Icon = SECTION_ICONS[i]
            return (
              <div className={`story-feature${i % 2 === 1 ? ' story-feature--reverse' : ''}`} key={i}>
                <section className="page-section--card">
                  <div className="card-icon"><Icon size={22} /></div>
                  <E as="h2" path={`about.s${i + 1}h${sfx}`} value={s.h} emphasis />
                  {s.p?.map((para, j) => (
                    <div className="hc-item-row" key={j}>
                      <E as="p" path={`about.s${i + 1}p${sfx}`} value={para} listIndex={j} emphasis />
                      {s.p.length > 1 && <RemoveItemButton paths={[`about.s${i + 1}p${sfx}`]} index={j} />}
                    </div>
                  ))}
                  <AddItemButton paths={[`about.s${i + 1}p${sfx}`]} label={hy ? 'Ավելացնել պարբերություն' : 'Add paragraph'} />
                </section>
                <div className="story-feature-media">
                  <EditableReel path={`about.s${i + 1}reel`} value={s.reel}>
                    {/* key by URL so a changed reel fully re-mounts and re-embeds
                        (Instagram's embed.js won't reprocess an existing embed) */}
                    <InstagramEmbed key={s.reel} url={s.reel} />
                  </EditableReel>
                </div>
              </div>
            )
          })}

          <section className="page-section page-section--card page-section--center">
            <E as="h2" path={`about.ctaText${sfx}`} value={c.ctaText} />
            <Link to="/register" className="page-cta"><E as="span" path={`about.cta${sfx}`} value={c.cta} /></Link>
          </section>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
