import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'

const copy = {
  en: {
    metaTitle: "About Us — Hasmik's Club",
    metaDesc: "Hasmik's Club is the #1 community for Armenian women 50+ — a place to meet, share, and belong.",
    eyebrow: 'About Us',
    title: 'A circle built for Armenian women.',
    sub: "Hasmik's Club is the first community created just for Armenian women 50+ — a place to meet face to face, share life openly, and feel that you are never alone.",
    sections: [
      {
        h: 'Our Story',
        p: [
          "For generations, the Armenian woman has been the heart of the family — the keeper of tradition, the quiet strength behind everything. Yet she rarely had a space built just for her.",
          "Hasmik's Club was born to change that: a warm, real community where women gather every two weeks in Yerevan and stay close on Telegram every single day.",
        ],
      },
      {
        h: 'Our Mission',
        p: [
          "We believe you do not have to disappear after a certain age. You deserve to be seen, heard, and surrounded by women who choose to live fully — curious, alive, and proud of who they are.",
        ],
      },
      {
        h: 'What We Believe',
        list: [
          'Life at any age is a beginning, not an ending.',
          'Women are stronger, warmer, and braver together.',
          'Real friendship grows face to face — over coffee, recipes, and honest conversation.',
          'Our roots and traditions are something to celebrate, not to outgrow.',
        ],
      },
    ],
    sig: '— With love, Hasmik',
    ctaText: 'Want to be part of the circle?',
    cta: 'Join the Circle',
  },
  hy: {
    metaTitle: "Մեր մասին — Hasmik's Club",
    metaDesc: "Hasmik's Club-ը 50+ հայ կանանց #1 համայնքն է՝ վայր, որտեղ կարելի է հանդիպել, կիսվել և պատկանել:",
    eyebrow: 'Մեր մասին',
    title: 'Շրջապատ՝ ստեղծված հայ կանանց համար։',
    sub: "Hasmik's Club-ը առաջին համայնքն է, որը ստեղծված է հենց 50+ հայ կանանց համար՝ վայր, որտեղ կարող ես հանդիպել դեմ առ դեմ, անկեղծ կիսվել կյանքով և զգալ, որ երբեք միայնակ չես։",
    sections: [
      {
        h: 'Մեր պատմությունը',
        p: [
          "Սերունդներ շարունակ հայ կինը եղել է ընտանիքի սիրտը՝ ավանդույթների պահապանը, լուռ ուժը, որի վրա հենվել է ամեն ինչ։ Բայց նա հազվադեպ է ունեցել մի վայր, որը ստեղծված է հենց իր համար։",
          "Hasmik's Club-ը ծնվեց հենց դա փոխելու համար՝ ջերմ, իրական համայնք, որտեղ կանայք ամեն երկու շաբաթը մեկ հանդիպում են Երևանում և ամեն օր մոտ են մնում Telegram-ում։",
        ],
      },
      {
        h: 'Մեր առաքելությունը',
        p: [
          "Մենք հավատում ենք, որ որոշ տարիքից հետո պետք չէ անհետանալ։ Դու արժանի ես տեսնված, լսված և շրջապատված լինելու կանանցով, ովքեր ընտրում են ապրել լիարժեք՝ հետաքրքրասեր, կենդանի և հպարտ իրենցով։",
        ],
      },
      {
        h: 'Ինչին ենք հավատում',
        list: [
          'Կյանքը ցանկացած տարիքում սկիզբ է, ոչ թե ավարտ։',
          'Կանայք միասին ավելի ուժեղ են, ավելի ջերմ և ավելի համարձակ։',
          'Իրական ընկերությունը աճում է դեմ առ դեմ՝ սուրճի, բաղադրատոմսերի և անկեղծ զրույցների շուրջ։',
          'Մեր արմատներն ու ավանդույթները տոնելու բան են, ոչ թե թողնելու։',
        ],
      },
    ],
    sig: '— Սիրով, Հասմիկ',
    ctaText: 'Ուզու՞մ ես մաս կազմել շրջապատին։',
    cta: 'Միանալ համայնքին',
  },
}

export default function AboutPage({ lang = 'en', setLang }) {
  const c = copy[lang] ?? copy.en
  return (
    <div className="page-shell">
      <Helmet>
        <title>{c.metaTitle}</title>
        <meta name="description" content={c.metaDesc} />
        <link rel="canonical" href="https://hasmiks.club/about" />
      </Helmet>
      <GlobalHeader lang={lang} setLang={setLang} />

      <main className="page-main">
        <header className="page-hero">
          <div className="page-eyebrow">{c.eyebrow}</div>
          <h1 className="page-title">{c.title}</h1>
          <p className="page-sub">{c.sub}</p>
        </header>

        <div className="page-body">
          {c.sections.map((s, i) => (
            <section className="page-section" key={i}>
              <h2>{s.h}</h2>
              {s.p?.map((para, j) => <p key={j}>{para}</p>)}
              {s.list && (
                <ul>{s.list.map((li, j) => <li key={j}>{li}</li>)}</ul>
              )}
            </section>
          ))}

          <div className="page-sig">{c.sig}</div>

          <section className="page-section">
            <h2>{c.ctaText}</h2>
            <Link to="/register" className="page-cta">{c.cta}</Link>
          </section>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
