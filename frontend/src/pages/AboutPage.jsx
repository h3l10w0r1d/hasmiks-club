import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'

const copy = {
  en: {
    metaTitle: "About Us — Hasmik's Club",
    metaDesc: "Hasmik's Club is the #1 club for Armenian women 50+ — a place to meet, share, and belong.",
    eyebrow: 'About Us',
    title: 'Life at 72 does not end.',
    sub: 'It can begin again.',
    sections: [
      {
        h: 'Our Story',
        p: [
          "I am Hasmik — 72 years old, a former teacher, mother and grandmother.",
          "I devoted most of my life to my family, my work, and people. Over the years I learned that every age has its own beauty, and that a person should never stop being curious, connecting, learning, and trying new things.",
          "One day I decided to share my thoughts, little stories, and life experience on Instagram. In just three months, more than 40,000 people gathered around our page. It showed me that many women need the same thing — honest words, warm connection, and a place where they are understood.",
          "That is how the idea of Hasmik's Club was born.",
        ],
      },
      {
        h: 'Why the club was created',
        p: [
          "Over the years, a woman takes on many roles. She cares for her family, children, grandchildren and loved ones — but sometimes leaves her own wishes and interests in the background.",
          "Hasmik's Club was created so that every woman also has time devoted to herself.",
          "It is a place to meet new people, talk openly, share life stories, laugh, join interesting gatherings, and simply spend a pleasant time.",
        ],
      },
      {
        h: 'More than a club',
        p: [
          "We meet in Yerevan at beautiful, calm places, visit cultural events, organize warm gatherings, and discover new pastimes together.",
          "And between meetings, the connection continues in our private Telegram club, where we share thoughts, stories, recipes, advice, and the small joys of everyday life.",
          "Hasmik's Club is not just a series of events. It is a circle of women where every member can be heard, accepted, and feel that she is awaited.",
        ],
      },
      {
        h: 'Our Purpose',
        p: [
          "We want to remind you that after 50, 60, or 70, life does not stop being interesting.",
          "You can always find new friends, learn something new, travel, discover a beloved pastime, and give more time to your own joy.",
          "For us, what matters most is warmth, honesty, mutual respect, and the feeling of belonging.",
          "Beautiful days are still ahead. Let us live them together.",
        ],
      },
    ],
    sig: '— With love, Hasmik',
    ctaText: 'Want to be part of the club?',
    cta: 'Join the Club',
  },
  hy: {
    metaTitle: "Մեր մասին — Hasmik's Club",
    metaDesc: "Hasmik's Club-ը 50+ հայ կանանց #1 ակումբն է՝ վայր, որտեղ կարելի է հանդիպել, կիսվել և պատկանել:",
    eyebrow: 'Մեր մասին',
    title: '72-ում կյանքը չի ավարտվում։',
    sub: 'Այն կարող է նորից սկսվել։',
    sections: [
      {
        h: 'Մեր պատմությունը',
        p: [
          "Ես Հասմիկն եմ՝ 72 տարեկան, նախկին մանկավարժ, մայր և տատիկ։",
          "Կյանքիս մեծ մասը նվիրել եմ ընտանիքիս, աշխատանքիս և մարդկանց։ Տարիների ընթացքում սովորել եմ, որ յուրաքանչյուր տարիք իր գեղեցկությունն ունի, իսկ մարդը երբեք չպետք է դադարի հետաքրքրվել, շփվել, սովորել և նոր բաներ փորձել։",
          "Մի օր որոշեցի Instagram-ում կիսվել իմ մտքերով, փոքրիկ պատմություններով և կյանքի փորձով։ Ընդամենը երեք ամսում մեր էջի շուրջ հավաքվեց ավելի քան 40,000 մարդ։ Դա ինձ ցույց տվեց, որ շատ կանայք նույն բանի կարիքն ունեն՝ անկեղծ խոսքի, ջերմ շփման և մի միջավայրի, որտեղ իրենց կհասկանան։",
          "Այդպես ծնվեց Հասմիկի ակումբի գաղափարը։",
        ],
      },
      {
        h: 'Ինչու ստեղծվեց ակումբը',
        p: [
          "Տարիների ընթացքում կինը բազմաթիվ դերեր է ստանձնում։ Նա հոգ է տանում ընտանիքի, երեխաների, թոռների և հարազատների մասին, բայց երբեմն իր ցանկություններն ու հետաքրքրությունները թողնում է երկրորդ պլանում։",
          "Հասմիկի ակումբը ստեղծվել է, որպեսզի յուրաքանչյուր կին ունենա նաև իրեն նվիրված ժամանակ։",
          "Սա մի վայր է, որտեղ կարելի է նոր մարդկանց ճանաչել, անկեղծ զրուցել, կիսվել կյանքի պատմություններով, ծիծաղել, մասնակցել հետաքրքիր հանդիպումների և պարզապես հաճելի ժամանակ անցկացնել։",
        ],
      },
      {
        h: 'Ակումբից ավելին',
        p: [
          "Մենք հանդիպում ենք Երևանում՝ գեղեցիկ ու հանգիստ վայրերում, այցելում մշակութային միջոցառումների, կազմակերպում ջերմ հավաքներ և միասին բացահայտում նոր զբաղմունքներ։",
          "Իսկ հանդիպումների միջև շփումը շարունակվում է մեր փակ Telegram ակումբում, որտեղ կիսվում ենք մտքերով, պատմություններով, բաղադրատոմսերով, խորհուրդներով և առօրյա փոքրիկ ուրախություններով։",
          "Հասմիկի ակումբը պարզապես միջոցառումների շարք չէ։ Այն կանանց շրջապատ է, որտեղ յուրաքանչյուր անդամ կարող է լսվել, ընդունվել և զգալ, որ իրեն սպասում են։",
        ],
      },
      {
        h: 'Մեր նպատակը',
        p: [
          "Մենք ուզում ենք հիշեցնել, որ 50-ից, 60-ից կամ 70-ից հետո կյանքը չի դադարում հետաքրքիր լինել։",
          "Միշտ կարելի է նոր ընկերներ գտնել, նոր բան սովորել, ճանապարհորդել, սիրելի զբաղմունք բացահայտել և ավելի շատ ժամանակ հատկացնել սեփական ուրախությանը։",
          "Մեզ համար ամենակարևորն են ջերմությունը, անկեղծությունը, փոխադարձ հարգանքը և պատկանելու զգացողությունը։",
          "Գեղեցիկ օրերը դեռ շատ են։ Եկեք դրանք միասին ապրենք։",
        ],
      },
    ],
    sig: '— Սիրով, Հասմիկ',
    ctaText: 'Ուզու՞մ ես մաս կազմել ակումբին։',
    cta: 'Միանալ ակումբին',
  },
}

export default function AboutPage({ lang = 'en', setLang }) {
  const c = copy[lang] ?? copy.en
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
