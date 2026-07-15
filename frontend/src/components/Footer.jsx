import { Link } from 'react-router-dom'

export default function Footer({ lang = 'en' }) {
  const hy = lang === 'hy'
  const t = {
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
    <footer>
      <Link to="/" className="ft-logo">Hasmik&apos;s <span>Club</span></Link>
      <nav className="ft-nav">
        <Link to="/">{t.home}</Link>
        <Link to="/events">{t.events}</Link>
        <Link to="/about">{t.about}</Link>
        <Link to="/contact">{t.contact}</Link>
        <Link to="/terms">{t.terms}</Link>
      </nav>
      <div className="ft-copy">{t.copy}</div>
    </footer>
  )
}
