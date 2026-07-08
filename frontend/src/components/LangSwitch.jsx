function FlagUS() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
      <rect width="20" height="14" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <rect key={i} y={i * 2} width="20" height="1" fill="#B22234" />
      ))}
      <rect width="9" height="7" fill="#3C3B6E" />
    </svg>
  )
}

function FlagAM() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
      <rect width="20" height="4.67" fill="#D90012" />
      <rect y="4.67" width="20" height="4.67" fill="#0033A0" />
      <rect y="9.33" width="20" height="4.67" fill="#F2A800" />
    </svg>
  )
}

// Shared EN/HY language toggle — flag icons instead of text, used in both
// the public site header and the member dashboard nav.
export default function LangSwitch({ lang, setLang, className = 'gh-lang', btnClassName = 'gh-lang-btn' }) {
  if (!setLang) return null
  return (
    <div className={className}>
      <button
        className={`${btnClassName}${lang === 'en' ? ' active' : ''}`}
        onClick={() => setLang('en')}
        title="English" aria-label="English"
      >
        <FlagUS />
      </button>
      <button
        className={`${btnClassName}${lang === 'hy' ? ' active' : ''}`}
        onClick={() => setLang('hy')}
        title="Հայերեն" aria-label="Հայերեն"
      >
        <FlagAM />
      </button>
    </div>
  )
}
