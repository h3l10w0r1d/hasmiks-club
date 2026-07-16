import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://www.instagram.com/embed.js'

function loadEmbedScript() {
  if (window.instgrm) {
    window.instgrm.Embeds.process()
    return
  }
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return
  const script = document.createElement('script')
  script.src = SCRIPT_SRC
  script.async = true
  document.body.appendChild(script)
}

// Renders a Facebook/Instagram-hosted oEmbed via their official embed.js —
// the same blockquote markup Instagram's own "Embed" button generates.
export default function InstagramEmbed({ url, caption }) {
  const ref = useRef(null)

  useEffect(() => {
    loadEmbedScript()
    const t = setTimeout(() => window.instgrm?.Embeds?.process(), 300)
    return () => clearTimeout(t)
  }, [url])

  return (
    <div className="ig-embed-wrap" ref={ref}>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={`${url}?utm_source=ig_embed&utm_campaign=loading`}
        data-instgrm-version="14"
        style={{ margin: '0 auto', maxWidth: 540, minWidth: 326, width: '100%' }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">{caption || url}</a>
      </blockquote>
    </div>
  )
}
