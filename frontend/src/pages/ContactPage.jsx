import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Mail, Phone, MapPin, Send, AtSign, MessageCircle } from 'lucide-react'
import GlobalHeader from '../components/GlobalHeader'
import Footer from '../components/Footer'
import { getPublicSettings, getMemberSettings } from '../api/payments'
import { useAuth } from '../context/AuthContext'
import { useContent } from '../context/SiteContentContext'
import { E, installEditGuards } from '../components/Editable'

// Placeholders + the mailto subject line stay as fixed English strings — they
// aren't visible page text (an input placeholder / an email header), so there's
// no natural place to click-to-edit them in the on-canvas editor.
const namePh = { en: 'Your full name', hy: 'Ձեր անուն ազգանունը' }
const emailPh = { en: 'your@email.com', hy: 'your@email.com' }
const messagePh = { en: 'Write your question or message…', hy: 'Գրիր քո հարցը կամ հաղորդագրությունը…' }
const mailSubject = { en: "Message from the Hasmik's Club website", hy: "Հաղորդագրություն Hasmik's Club կայքից" }

export default function ContactPage({ lang = 'en', setLang }) {
  const t = useContent()
  const a = t.contact
  const hy = lang === 'hy'
  const sfx = hy ? 'Hy' : 'En'
  const L = (base) => a[`${base}${sfx}`]
  const c = {
    metaTitle: L('metaTitle'), metaDesc: L('metaDesc'),
    title: L('title'), sub: L('sub'),
    telegram: L('telegram'), instagram: L('instagram'), email: L('email'), location: L('location'), phone: L('phone'),
    telegramValue: L('telegramValue'),
    infoTitle: L('infoTitle'), formTitle: L('formTitle'),
    name: L('name'), emailLabel: L('emailLabel'), message: L('message'),
    namePh: hy ? namePh.hy : namePh.en, emailPh: hy ? emailPh.hy : emailPh.en, messagePh: hy ? messagePh.hy : messagePh.en,
    send: L('send'), noEmail: L('noEmail'),
    mailSubject: hy ? mailSubject.hy : mailSubject.en,
  }
  useEffect(() => { installEditGuards() }, [])
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
          <E as="h1" className="page-title" path={`contact.title${sfx}`} value={c.title} />
          <E as="p" className="page-sub" path={`contact.sub${sfx}`} value={c.sub} emphasis />
        </header>

        <div className="contact-layout">
          {/* LEFT — message form */}
          <div className="contact-form-card">
            <E as="div" className="cf-card-title" path={`contact.formTitle${sfx}`} value={c.formTitle} />
            {email ? (
              <form className="contact-form" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="cf-name"><E as="span" path={`contact.name${sfx}`} value={c.name} /></label>
                  <input id="cf-name" required placeholder={c.namePh} value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="cf-email"><E as="span" path={`contact.emailLabel${sfx}`} value={c.emailLabel} /></label>
                  <input id="cf-email" type="email" required placeholder={c.emailPh} value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="cf-message"><E as="span" path={`contact.message${sfx}`} value={c.message} /></label>
                  <textarea id="cf-message" rows={6} required placeholder={c.messagePh} value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                </div>
                <button type="submit"><Send size={17} /> <E as="span" path={`contact.send${sfx}`} value={c.send} /></button>
              </form>
            ) : (
              <E as="p" className="cf-noemail" path={`contact.noEmail${sfx}`} value={c.noEmail} />
            )}
          </div>

          {/* RIGHT — contact details */}
          <aside className="contact-info-card">
            <E as="div" className="ci-title" path={`contact.infoTitle${sfx}`} value={c.infoTitle} />

            {telegram && (
              <a className="ci-row" href={telegram} target="_blank" rel="noopener noreferrer">
                <span className="ci-icon"><MessageCircle size={18} /></span>
                <span className="ci-text">
                  <E as="span" className="ci-label" path={`contact.telegram${sfx}`} value={c.telegram} />
                  <E as="span" className="ci-value" path={`contact.telegramValue${sfx}`} value={c.telegramValue} />
                </span>
              </a>
            )}
            {igUrl && (
              <a className="ci-row" href={igUrl} target="_blank" rel="noopener noreferrer">
                <span className="ci-icon"><AtSign size={18} /></span>
                <span className="ci-text">
                  <E as="span" className="ci-label" path={`contact.instagram${sfx}`} value={c.instagram} />
                  <span className="ci-value">@{igHandle}</span>
                </span>
              </a>
            )}
            {email && (
              <a className="ci-row" href={`mailto:${email}`}>
                <span className="ci-icon"><Mail size={18} /></span>
                <span className="ci-text">
                  <E as="span" className="ci-label" path={`contact.email${sfx}`} value={c.email} />
                  <span className="ci-value">{email}</span>
                </span>
              </a>
            )}
            {phone && (
              <a className="ci-row" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                <span className="ci-icon"><Phone size={18} /></span>
                <span className="ci-text">
                  <E as="span" className="ci-label" path={`contact.phone${sfx}`} value={c.phone} />
                  <span className="ci-value">{phone}</span>
                </span>
              </a>
            )}
            {location && (
              <a className="ci-row" href={`https://maps.google.com/?q=${encodeURIComponent(location)}`} target="_blank" rel="noopener noreferrer">
                <span className="ci-icon"><MapPin size={18} /></span>
                <span className="ci-text">
                  <E as="span" className="ci-label" path={`contact.location${sfx}`} value={c.location} />
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
