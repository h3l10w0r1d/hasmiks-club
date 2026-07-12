import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'img']
const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt']

// Renders Tiptap-authored HTML (event/content descriptions) safely — the
// backend stores/serves this HTML verbatim with no server-side sanitization,
// so every render site must sanitize before dangerouslySetInnerHTML.
export function sanitizeHtml(html) {
  if (!html) return ''
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

// Plain-text extraction for card/list teasers where only a short preview is
// wanted, not the full rich content (which lives on the detail page/modal).
export function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
