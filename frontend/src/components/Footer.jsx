import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, AtSign } from 'lucide-react'
import { getPublicSettings } from '../api/payments'

export default function Footer({ lang = 'en' }) {
  const hy = lang === 'hy'
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
    tagline: hy
      ? 'Ջերմ ակումբ 50+ հայ կանանց համար՝ հանդիպումներ, կապ ու պատկանելիություն։'
      : 'A warm club for Armenian women 50+ — gatherings, connection, and belonging.',
    linksTitle: hy ? 'Նավարկություն' : 'Explore',
    contactTitle: hy ? 'Կապ' : 'Contact',
    home:    hy ? 'Գլխավոր'        : 'Home',
    events:  hy ? 'Հանդիպումներ'   : 'Events',
    about:   hy ? 'Մեր մասին'      : 'About Us',
    contact: hy ? 'Կապ'           : 'Contact',
    terms:   hy ? 'Պայմաններ'     : 'Terms',
    copy:    hy
      ? '© 2026 Hasmik\'s Club — 50+ հայ կանանց ակումբ'
      : '© 2026 Hasmik\'s Club — #1 · 50+ Armenian Women\'s Club',
  }

  return (
    <footer className="site-footer">
      <div className="ft-top">
        <div className="ft-brand">
          <Link to="/" className="ft-logo">Hasmik&apos;s <span>Club</span></Link>
          <p className="ft-tagline">{t.tagline}</p>
          {igUrl && (
            <a className="ft-social" href={igUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <AtSign size={17} />
            </a>
          )}
        </div>

        <div className="ft-col">
          <div className="ft-col-title">{t.linksTitle}</div>
          <nav className="ft-nav">
            <Link to="/">{t.home}</Link>
            <Link to="/events">{t.events}</Link>
            <Link to="/about">{t.about}</Link>
            <Link to="/contact">{t.contact}</Link>
            <Link to="/terms">{t.terms}</Link>
          </nav>
        </div>

        <div className="ft-col">
          <div className="ft-col-title">{t.contactTitle}</div>
          <div className="ft-contact">
            {email && <a href={`mailto:${email}`}><Mail size={15} />{email}</a>}
            {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone size={15} />{phone}</a>}
            {location && <span><MapPin size={15} />{location}</span>}
          </div>
        </div>
      </div>

      <div className="ft-bottom">
        <div className="ft-copy">{t.copy}</div>
      </div>
    </footer>
  )
}
