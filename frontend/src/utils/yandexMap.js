// Turns a Yandex Maps link (as pasted by an admin from the browser address
// bar) into an embeddable map-widget URL. Yandex only allows framing of its
// own map-widget/v1 endpoint, not regular /maps/ share pages, so we lift the
// ll (center) / z (zoom) / pt (placemark) query params off the given URL and
// rebuild a widget URL from them. Short links (yandex.ru/maps/-/xyz) and org
// pages with no coords in the query string can't be resolved client-side —
// callers should fall back to a plain "open in Yandex Maps" link in that case.
export function yandexEmbedUrl(url) {
  if (!url) return null
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!/(^|\.)yandex\.[a-z.]+$/.test(parsed.hostname)) return null

  if (parsed.pathname.includes('/map-widget/')) return parsed.href

  const ll = parsed.searchParams.get('ll')
  if (!ll) return null
  const z = parsed.searchParams.get('z') || '16'
  const pt = parsed.searchParams.get('pt') || `${ll},pm2rdm`

  const embed = new URL('https://yandex.ru/map-widget/v1/')
  embed.searchParams.set('ll', ll)
  embed.searchParams.set('z', z)
  embed.searchParams.set('pt', pt)
  return embed.href
}
