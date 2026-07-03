import t from '../data/content'
import Reveal from './Reveal'

export default function Band({ lang }) {
  return (
    <Reveal as="div" className="band">
      <span className="band-dot"></span>
      <p className="band-text">
        {lang === 'en' ? t.band.en : t.band.hy}
      </p>
      <span className="band-dot"></span>
    </Reveal>
  )
}
