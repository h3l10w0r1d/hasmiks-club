import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import t from '../data/content'

export default function Nav({ lang, setLang }) {
  const { user } = useAuth()

  return (
    <nav>
      <Link to="/" className="nav-logo" style={{ textDecoration: 'none' }}>
        Hasmik's <span>Club</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="lang-toggle">
          <button className={`lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => setLang('en')}>EN</button>
          <button className={`lang-btn${lang === 'hy' ? ' active' : ''}`} onClick={() => setLang('hy')}>ՀԱՅ</button>
        </div>
        {user ? (
          <div style={{ display: 'flex', gap: 10 }}>
            {user.is_admin && (
              <Link to="/admin" className="nav-btn" style={{ background: 'var(--deep)' }}>Admin</Link>
            )}
            <Link to="/dashboard" className="nav-btn">
              {lang === 'en' ? 'My Account' : 'Իմ հաշիվը'}
            </Link>
          </div>
        ) : (
          <Link to="/register" className="nav-btn">
            {lang === 'en' ? t.nav.joinEn : t.nav.joinHy}
          </Link>
        )}
      </div>
    </nav>
  )
}
