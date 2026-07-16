import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Mail, Phone, MapPin, Send, AtSign, MessageCircle } from 'lucide-react'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'
import { getPublicSettings, getMemberSettings } from '../api/payments'
import { useAuth } from '../context/AuthContext'

const copy = {
  en: {
    metaTitle: "Contact — Hasmik's Club",
    metaDesc: "Get in touch with Hasmik's Club — questions about joining, gatherings, or anything else.",
    eyebrow: 'Get in Touch',
    title: "We'd love to hear from you.",
    sub: "Questions about joining, our gatherings, or anything else? Reach us through any of the channels below — Telegram is the fastest way.",
    telegram: 'Telegram', instagram: 'Instagram', email: 'Email', location: 'Location', phone: 'Phone',
    telegramValue: 'Message us on Telegram',
    infoTitle: 'Contact details',
    formTitle: 'Send us a message',
    name: 'Name', emailLabel: 'Email', message: 'Message',
    namePh: 'Your full name', emailPh: 'your@email.com', messagePh: 'Write your question or message…',
    send: 'Send message',
    noEmail: "The fastest way to reach us is on Telegram — tap the card on the right and say hello.",
    mailSubject: "Message from the Hasmik's Club website",
  },
  hy: {
    metaTitle: "Կապ — Hasmik's Club",
    metaDesc: "Կապվիր Hasmik's Club-ի հետ՝ անդամակցության, հանդիպումների կամ այլ հարցերի համար:",
    eyebrow: 'Կապ մեզ հետ',
    title: 'Ուրախ կլինենք լսել քեզնից։',
    sub: "Հարցե՞ր ունես անդամակցության, հանդիպումների կամ այլ բանի մասին։ Կապվիր մեզ հետ ստորև նշված ցանկացած եղանակով․ ամենաարագը Telegram-ն է։",
    telegram: 'Telegram', instagram: 'Instagram', email: 'Էլ. փոստ', location: 'Հասցե', phone: 'Հեռախոս',
    telegramValue: 'Գրիր մեզ Telegram-ում',
    infoTitle: 'Կոնտակտային տվյալներ',
    formTitle: 'Ուղարկիր մեզ հաղորդագրություն',
    name: 'Անուն', emailLabel: 'Էլ. փոստ', message: 'Հաղորդագրություն',
    namePh: 'Ձեր անուն ազգանունը', emailPh: 'your@email.com', messagePh: 'Գրիր քո հարցը կամ հաղորդագրությունը…',
    send: 'Ուղարկել',
    noEmail: 'Մեզ հետ կապվելու ամենաարագ ձևը Telegram-ն է․ սեղմիր աջ կողմի քարտը և ողջունիր մեզ։',
    mailSubject: "Հաղորդագրություն Hasmik's Club կայքից",
  },
}

export default function ContactPage({ lang = 'en', setLang }) {
  const c = copy[lang] ?? copy.en
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [telegram, setTelegram] = useState('')
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  useEffect(() => {
    getPublicSettings().then(setSettings).catch(() => setSettings({}))
  }, [])

  // The private Telegram group invite is members-only — /settings/member
  // itself refuses to return it for anyone without an active subscription,
  // so this is a defense-in-depth check, not the actual access control.
  useEffect(() => {
    if (user?.membership_status === 'active') {
      getMemberSettings().then(s => setTelegram(s.telegram_invite_url || '')).catch(() => {})
    } else {
      setTelegram('')
    }
  }, [user])

  const igRaw = settings?.club_instagram || ''
  const igHandle = igRaw.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  const igUrl = igHandle ? `https://instagram.com/${igHandle}` : ''
  const location = settings?.club_location || ''
  const email = settings?.club_email || ''
  const phone = settings?.club_phone || ''

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

        <div className="contact-layout">
          {/* LEFT — message form */}
          <div className="contact-form-card">
            <div className="cf-card-title">{c.formTitle}</div>
            {email ? (
              <form className="contact-form" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="cf-name">{c.name}</label>
                  <input id="cf-name" required placeholder={c.namePh} value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="cf-email">{c.emailLabel}</label>
                  <input id="cf-email" type="email" required placeholder={c.emailPh} value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="cf-message">{c.message}</label>
                  <textarea id="cf-message" rows={6} required placeholder={c.messagePh} value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                </div>
                <button type="submit"><Send size={17} /> {c.send}</button>
              </form>
            ) : (
              <p className="cf-noemail">{c.noEmail}</p>
            )}
          </div>

          {/* RIGHT — contact details */}
          <aside className="contact-info-card">
            <div className="ci-title">{c.infoTitle}</div>

            {telegram && (
              <a className="ci-row" href={telegram} target="_blank" rel="noopener noreferrer">
                <span className="ci-icon"><MessageCircle size={18} /></span>
                <span className="ci-text">
                  <span className="ci-label">{c.telegram}</span>
                  <span className="ci-value">{c.telegramValue}</span>
                </span>
              </a>
            )}
            {igUrl && (
              <a className="ci-row" href={igUrl} target="_blank" rel="noopener noreferrer">
                <span className="ci-icon"><AtSign size={18} /></span>
                <span className="ci-text">
                  <span className="ci-label">{c.instagram}</span>
                  <span className="ci-value">@{igHandle}</span>
                </span>
              </a>
            )}
            {email && (
              <a className="ci-row" href={`mailto:${email}`}>
                <span className="ci-icon"><Mail size={18} /></span>
                <span className="ci-text">
                  <span className="ci-label">{c.email}</span>
                  <span className="ci-value">{email}</span>
                </span>
              </a>
            )}
            {phone && (
              <a className="ci-row" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                <span className="ci-icon"><Phone size={18} /></span>
                <span className="ci-text">
                  <span className="ci-label">{c.phone}</span>
                  <span className="ci-value">{phone}</span>
                </span>
              </a>
            )}
            {location && (
              <a className="ci-row" href={`https://maps.google.com/?q=${encodeURIComponent(location)}`} target="_blank" rel="noopener noreferrer">
                <span className="ci-icon"><MapPin size={18} /></span>
                <span className="ci-text">
                  <span className="ci-label">{c.location}</span>
                  <span className="ci-value">{location}</span>
                </span>
              </a>
            )}
          </aside>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  )
}
