import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'
import { getPublicSettings } from '../api/payments'

const copy = {
  en: {
    metaTitle: "Contact — Hasmik's Club",
    metaDesc: "Get in touch with Hasmik's Club — questions about joining, gatherings, or anything else.",
    eyebrow: 'Get in Touch',
    title: "We'd love to hear from you.",
    sub: "Questions about joining, our gatherings, or anything else? Reach us through any of the channels below — Telegram is the fastest way.",
    telegram: 'Telegram', instagram: 'Instagram', email: 'Email', location: 'Location',
    telegramValue: 'Message us on Telegram',
    formTitle: 'Send us a message',
    name: 'Your name', emailLabel: 'Your email', message: 'Message',
    send: 'Send message',
    noEmail: "The fastest way to reach us is on Telegram — tap the card above and say hello.",
    mailSubject: "Message from the Hasmik's Club website",
  },
  hy: {
    metaTitle: "Կապ — Hasmik's Club",
    metaDesc: "Կապվիր Hasmik's Club-ի հետ՝ անդամակցության, հանդիպումների կամ այլ հարցերի համար:",
    eyebrow: 'Կապ մեզ հետ',
    title: 'Ուրախ կլինենք լսել քեզնից։',
    sub: "Հարցե՞ր ունես անդամակցության, հանդիպումների կամ այլ բանի մասին։ Կապվիր մեզ հետ ստորև նշված ցանկացած եղանակով․ ամենաարագը Telegram-ն է։",
    telegram: 'Telegram', instagram: 'Instagram', email: 'Էլ. փոստ', location: 'Հասցե',
    telegramValue: 'Գրիր մեզ Telegram-ում',
    formTitle: 'Ուղարկիր մեզ հաղորդագրություն',
    name: 'Քո անունը', emailLabel: 'Քո էլ. փոստը', message: 'Հաղորդագրություն',
    send: 'Ուղարկել',
    noEmail: 'Մեզ հետ կապվելու ամենաարագ ձևը Telegram-ն է․ սեղմիր վերևի քարտը և ողջունիր մեզ։',
    mailSubject: "Հաղորդագրություն Hasmik's Club կայքից",
  },
}

export default function ContactPage({ lang = 'en', setLang }) {
  const c = copy[lang] ?? copy.en
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  useEffect(() => {
    getPublicSettings().then(setSettings).catch(() => setSettings({}))
  }, [])

  const telegram = settings?.telegram_invite_url || ''
  const igRaw = settings?.club_instagram || ''
  const igHandle = igRaw.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  const igUrl = igHandle ? `https://instagram.com/${igHandle}` : ''
  const location = settings?.club_location || ''
  const email = settings?.club_email || ''

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email) return
    const body = `${form.message}\n\n— ${form.name} (${form.email})`
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(c.mailSubject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="page-shell">
      <Helmet>
        <title>{c.metaTitle}</title>
        <meta name="description" content={c.metaDesc} />
        <link rel="canonical" href="https://www.hasmiksclub.am/contact" />
      </Helmet>
      <GlobalHeader lang={lang} setLang={setLang} />

      <main className="page-main">
        <header className="page-hero">
          <div className="page-eyebrow">{c.eyebrow}</div>
          <h1 className="page-title">{c.title}</h1>
          <p className="page-sub">{c.sub}</p>
        </header>

        <div className="page-body">
          <div className="contact-grid">
            {telegram && (
              <a className="contact-card" href={telegram} target="_blank" rel="noopener noreferrer">
                <span className="cc-label">{c.telegram}</span>
                <span className="cc-value">{c.telegramValue} →</span>
              </a>
            )}
            {igUrl && (
              <a className="contact-card" href={igUrl} target="_blank" rel="noopener noreferrer">
                <span className="cc-label">{c.instagram}</span>
                <span className="cc-value">@{igHandle}</span>
              </a>
            )}
            {email && (
              <a className="contact-card" href={`mailto:${email}`}>
                <span className="cc-label">{c.email}</span>
                <span className="cc-value">{email}</span>
              </a>
            )}
            {location && (
              <a className="contact-card" href={`https://maps.google.com/?q=${encodeURIComponent(location)}`} target="_blank" rel="noopener noreferrer">
                <span className="cc-label">{c.location}</span>
                <span className="cc-value">{location}</span>
              </a>
            )}
          </div>

          <section className="page-section">
            <h2>{c.formTitle}</h2>
            {email ? (
              <form className="contact-form" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="cf-name">{c.name}</label>
                  <input id="cf-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="cf-email">{c.emailLabel}</label>
                  <input id="cf-email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="cf-message">{c.message}</label>
                  <textarea id="cf-message" rows={5} required value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                </div>
                <button type="submit">{c.send}</button>
              </form>
            ) : (
              <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--mocha)' }}>{c.noEmail}</p>
            )}
          </section>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
