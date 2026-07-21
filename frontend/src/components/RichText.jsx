import { Fragment } from 'react'

// Lightweight inline renderer for editable copy. Supports **bold**, *italic*
// (rendered as <strong>/<em> — which the landing CSS styles rose/accent) and
// newlines as <br>. This lets admins keep the designed emphasis while editing
// plain text in the Site Editor, without any HTML/markup risk.
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g

function renderLine(line, keyBase) {
  const parts = line.split(TOKEN).filter(Boolean)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`${keyBase}-${i}`} className="hc-featured">{part.slice(1, -1)}</em>
    }
    return <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>
  })
}

export default function RichText({ text }) {
  if (text == null) return null
  const lines = String(text).split('\n')
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderLine(line, i)}
    </Fragment>
  ))
}
