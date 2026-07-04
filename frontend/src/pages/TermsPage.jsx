import { Helmet } from 'react-helmet-async'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'

const copy = {
  en: {
    metaTitle: "Terms & Conditions — Hasmik's Club",
    metaDesc: "The terms and conditions governing membership of Hasmik's Club.",
    eyebrow: 'Legal',
    title: 'Terms & Conditions',
    updated: 'Last updated: 30 June 2026',
    intro: "Welcome to Hasmik's Club. These Terms & Conditions govern your membership and use of our community, website, events, and services. By joining or using Hasmik's Club, you agree to these terms.",
    sections: [
      { h: '1. Membership & Eligibility', p: ["Hasmik's Club is a private community for women. Membership is personal to you and may not be shared or transferred. We may review applications and reserve the right to accept or decline membership at our discretion."] },
      { h: '2. Membership Fees & Payment', p: ["Membership is offered for a recurring monthly fee, displayed at the current rate on our website. Fees are billed in advance and your membership renews automatically each month until cancelled. You authorise us (and our payment provider) to charge your chosen payment method for each billing cycle."] },
      { h: '3. Cancellation & Refunds', p: ["You may cancel your membership at any time; cancellation takes effect at the end of your current billing period, and you will retain access until then. Except where required by law, fees already paid are non-refundable."] },
      { h: '4. Events & Gatherings', p: ["Membership includes access to in-person gatherings and online activities. Dates, locations, and details may change. Seats may be limited, and attendance may require advance reservation. You take part in events at your own responsibility and agree to act respectfully toward other members and hosts."] },
      { h: '5. Member Conduct', p: ["We are a community built on warmth, respect, and trust. You agree not to harass, harm, or discriminate against other members, and not to use the community or its channels for spam, advertising, or unlawful purposes. We may suspend or remove members who violate these standards."] },
      { h: '6. Content & Intellectual Property', p: ["Recipes, e-books, photos, and other materials shared within Hasmik's Club are for members' personal use only and may not be copied, redistributed, or sold. All club branding and content remain the property of Hasmik's Club or its licensors."] },
      { h: '7. Privacy', p: ["We collect and use your personal information only to operate the community, process payments, and communicate with you. We do not sell your personal data. By joining, you consent to receive membership-related communications from us."] },
      { h: '8. Disclaimers & Liability', p: ["Hasmik's Club is provided on an “as is” basis. To the fullest extent permitted by law, we are not liable for indirect or incidental damages arising from your membership or attendance at events. Nothing in these terms limits liability that cannot be limited by law."] },
      { h: '9. Changes to These Terms', p: ["We may update these terms from time to time. Significant changes will be communicated to members, and continued use of your membership after changes take effect constitutes acceptance of the updated terms."] },
      { h: '10. Contact', p: ["If you have any questions about these terms, please reach out to us through our Contact page."] },
    ],
  },
  hy: {
    metaTitle: "Պայմաններ — Hasmik's Club",
    metaDesc: "Hasmik's Club-ի անդամակցությունը կարգավորող պայմաններն ու դրույթները:",
    eyebrow: 'Իրավական',
    title: 'Պայմաններ և դրույթներ',
    updated: 'Վերջին թարմացում՝ 30 հունիսի 2026',
    intro: "Բարի գալուստ Hasmik's Club։ Սույն պայմաններն ու դրույթները կարգավորում են ձեր անդամակցությունը և մեր համայնքից, կայքից, միջոցառումներից ու ծառայություններից օգտվելը։ Միանալով կամ օգտվելով Hasmik's Club-ից՝ դուք համաձայնում եք այս պայմաններին։",
    sections: [
      { h: '1. Անդամակցություն և իրավասություն', p: ["Hasmik's Club-ը կանանց փակ համայնք է։ Անդամակցությունը անձնական է և չի կարող փոխանցվել կամ կիսվել ուրիշների հետ։ Մենք կարող ենք դիտարկել դիմումները և իրավունք ենք վերապահում մեր հայեցողությամբ ընդունել կամ մերժել անդամակցությունը։"] },
      { h: '2. Անդամավճար և վճարում', p: ["Անդամակցությունը տրամադրվում է ամսական պարբերական վճարով՝ մեր կայքում նշված ընթացիկ դրույքաչափով։ Վճարը գանձվում է կանխավճարով, և ձեր անդամակցությունը ինքնաբերաբար երկարաձգվում է ամեն ամիս՝ մինչև չեղարկելը։ Դուք լիազորում եք մեզ (և մեր վճարային ծառայությանը) գանձել ձեր ընտրած վճարման եղանակից յուրաքանչյուր ժամանակահատվածի համար։"] },
      { h: '3. Չեղարկում և վերադարձ', p: ["Դուք կարող եք չեղարկել ձեր անդամակցությունը ցանկացած պահի․ չեղարկումն ուժի մեջ է մտնում ընթացիկ վճարման ժամանակահատվածի վերջում, և մինչ այդ դուք պահպանում եք մուտքը։ Բացառությամբ օրենքով նախատեսված դեպքերի՝ արդեն վճարված գումարները ենթակա չեն վերադարձման։"] },
      { h: '4. Միջոցառումներ և հանդիպումներ', p: ["Անդամակցությունը ներառում է մասնակցություն կենդանի հանդիպումներին և առցանց գործունեությանը։ Ամսաթվերը, վայրերը և մանրամասները կարող են փոփոխվել։ Տեղերը կարող են սահմանափակ լինել, և մասնակցությունը կարող է պահանջել նախնական ամրագրում։ Դուք մասնակցում եք միջոցառումներին ձեր պատասխանատվությամբ և համաձայնում եք հարգալից վերաբերվել մյուս անդամներին ու կազմակերպիչներին։"] },
      { h: '5. Անդամի վարքագիծ', p: ["Մեր համայնքը կառուցված է ջերմության, հարգանքի և վստահության վրա։ Դուք համաձայնում եք չհետապնդել, չվնասել կամ չխտրականացնել մյուս անդամներին, և համայնքը կամ նրա ալիքները չօգտագործել սպամի, գովազդի կամ անօրինական նպատակների համար։ Մենք կարող ենք կասեցնել կամ հեռացնել այս չափանիշները խախտող անդամներին։"] },
      { h: '6. Բովանդակություն և մտավոր սեփականություն', p: ["Hasmik's Club-ում կիսվող բաղադրատոմսերը, էլեկտրոնային գրքերը, լուսանկարները և այլ նյութերը նախատեսված են միայն անդամների անձնական օգտագործման համար և չեն կարող պատճենվել, վերաբաշխվել կամ վաճառվել։ Ակումբի ողջ ապրանքանիշը և բովանդակությունը մնում են Hasmik's Club-ի կամ նրա լիցենզատուների սեփականությունը։"] },
      { h: '7. Գաղտնիություն', p: ["Մենք հավաքում և օգտագործում ենք ձեր անձնական տվյալները միայն համայնքը կառավարելու, վճարումները մշակելու և ձեզ հետ կապ պահպանելու համար։ Մենք չենք վաճառում ձեր անձնական տվյալները։ Միանալով՝ դուք համաձայնում եք ստանալ անդամակցության հետ կապված հաղորդագրություններ մեզանից։"] },
      { h: '8. Հրաժարումներ և պատասխանատվություն', p: ["Hasmik's Club-ը տրամադրվում է «ինչպես կա» սկզբունքով։ Օրենքով թույլատրված առավելագույն չափով՝ մենք պատասխանատվություն չենք կրում ձեր անդամակցությունից կամ միջոցառումներին մասնակցությունից բխող անուղղակի կամ պատահական վնասների համար։ Սույն պայմաններում ոչինչ չի սահմանափակում այն պատասխանատվությունը, որը չի կարող սահմանափակվել օրենքով։"] },
      { h: '9. Պայմանների փոփոխություններ', p: ["Մենք կարող ենք ժամանակ առ ժամանակ թարմացնել այս պայմանները։ Էական փոփոխությունների մասին կտեղեկացվի անդամներին, և փոփոխություններն ուժի մեջ մտնելուց հետո անդամակցության շարունակական օգտագործումը նշանակում է թարմացված պայմանների ընդունում։"] },
      { h: '10. Կապ', p: ["Եթե այս պայմանների վերաբերյալ հարցեր ունեք, խնդրում ենք կապվել մեզ հետ մեր «Կապ» էջի միջոցով։"] },
    ],
  },
}

export default function TermsPage({ lang = 'en', setLang }) {
  const c = copy[lang] ?? copy.en
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
          <div className="page-eyebrow">{c.eyebrow}</div>
          <h1 className="page-title">{c.title}</h1>
          <p className="page-updated">{c.updated}</p>
        </header>

        <div className="page-body">
          <section className="page-section">
            <p>{c.intro}</p>
          </section>
          {c.sections.map((s, i) => (
            <section className="page-section" key={i}>
              <h2>{s.h}</h2>
              {s.p.map((para, j) => <p key={j}>{para}</p>)}
            </section>
          ))}
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
