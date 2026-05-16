import t from '../data/content'

export default function Band({ lang }) {
  return (
    <div className="band">
      <span className="band-dot"></span>
      <p className="band-text">
        {lang === 'en' ? t.band.en : t.band.hy}
      </p>
      <span className="band-dot"></span>
    </div>
  )
}
