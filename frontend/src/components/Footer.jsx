import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, AtSign } from 'lucide-react'
import { getPublicSettings } from '../api/payments'
import { useContent } from '../context/SiteContentContext'
import { E } from './Editable'

export default function Footer({ lang = 'en' }) {
  const hy = lang === 'hy'
  const sfx = hy ? 'Hy' : 'En'
  const site = useContent()
  const f = site.footer
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    getPublicSettings().then(setSettings).catch(() => setSettings({}))
  }, [])

  const igRaw = settings?.club_instagram || ''
  const igHandle = igRaw.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  const igUrl = igHandle ? `https://instagram.com/${igHandle}` : ''
  const email = settings?.club_email || ''
  const phone = settings?.club_phone || ''
  const location = settings?.club_location || ''

  const t = {
    tagline: f[`tagline${sfx}`],
    linksTitle: f[`linksTitle${sfx}`],
    contactTitle: f[`contactTitle${sfx}`],
    home: f[`home${sfx}`], events: f[`events${sfx}`], about: f[`about${sfx}`],
    contact: f[`contact${sfx}`], terms: f[`terms${sfx}`],
    copy: f[`copy${sfx}`],
  }

  return (
    <footer className="site-footer">
      <div className="ft-top">
        <div className="ft-brand">
          <Link to="/" className="ft-logo">Hasmik&apos;s <span>Club</span></Link>
          <E as="p" className="ft-tagline" path={`footer.tagline${sfx}`} value={t.tagline} />
          {igUrl && (
            <a className="ft-social" href={igUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <AtSign size={17} />
            </a>
          )}
        </div>

        <div className="ft-col">
          <E as="div" className="ft-col-title" path={`footer.linksTitle${sfx}`} value={t.linksTitle} />
          <nav className="ft-nav">
            <Link to="/"><E as="span" path={`footer.home${sfx}`} value={t.home} /></Link>
            <Link to="/events"><E as="span" path={`footer.events${sfx}`} value={t.events} /></Link>
            <Link to="/about"><E as="span" path={`footer.about${sfx}`} value={t.about} /></Link>
            <Link to="/contact"><E as="span" path={`footer.contact${sfx}`} value={t.contact} /></Link>
            <Link to="/terms"><E as="span" path={`footer.terms${sfx}`} value={t.terms} /></Link>
          </nav>
        </div>

        <div className="ft-col">
          <E as="div" className="ft-col-title" path={`footer.contactTitle${sfx}`} value={t.contactTitle} />
          <div className="ft-contact">
            {email && <a href={`mailto:${email}`}><Mail size={15} />{email}</a>}
            {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone size={15} />{phone}</a>}
            {location && <span><MapPin size={15} />{location}</span>}
          </div>
        </div>
      </div>

      <div className="ft-bottom">
        <E as="div" className="ft-copy" path={`footer.copy${sfx}`} value={t.copy} />
      </div>
    </footer>
  )
}
