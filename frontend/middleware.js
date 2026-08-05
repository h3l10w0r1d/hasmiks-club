// Vercel Edge Middleware — framework-agnostic (works for this plain Vite
// SPA the same way it would for Next.js; it's a platform feature, not tied
// to a specific framework).
//
// Why this exists: vercel.json's SPA catch-all rewrite (`/(.*)` -> `/index.html`)
// means every request that doesn't match a real static file gets a 200 with
// the app shell — including genuinely nonexistent URLs, which should 404.
// This checks the request path against every route the app actually
// defines (see src/App.jsx's <Routes>) and returns a real 404 status for
// anything else, while still serving the SPA shell as the body so
// NotFoundPage renders normally for a human visitor who followed a bad link.
//
// The matcher below excludes any path with a dot in it (covers every static
// asset: /assets/*.js, images, robots.txt, sitemap.xml, favicons, the PWA
// manifest/service worker, ...) so this only ever runs for page-like
// navigations, never for asset requests — keeps it cheap and low-risk.
export const config = {
  matcher: ['/((?!.*\\.).*)'],
}

// Static routes exactly as declared in src/App.jsx's <Routes>.
const STATIC_ROUTES = new Set([
  '/', '/preview', '/login', '/register', '/forgot-password', '/reset-password',
  '/events', '/about', '/contact', '/terms', '/gift',
  '/dashboard', '/welcome', '/admin', '/admin/scan',
])

// Dynamic route patterns, same shapes as src/App.jsx.
const DYNAMIC_ROUTES = [
  /^\/events\/[^/]+$/,
  /^\/p\/[^/]+$/,
  /^\/gift\/claim\/[^/]+$/,
  /^\/admin\/members\/[^/]+$/,
]

function isKnownRoute(pathname) {
  if (STATIC_ROUTES.has(pathname)) return true
  return DYNAMIC_ROUTES.some((re) => re.test(pathname))
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url)

  if (isKnownRoute(pathname)) {
    return undefined // continue — filesystem/rewrite handles it normally
  }

  // Unknown path: still serve the SPA shell (so NotFoundPage renders for a
  // human), but with a genuine 404 status for crawlers/link checkers.
  const shellUrl = new URL('/index.html', request.url)
  const shellResponse = await fetch(shellUrl)
  return new Response(shellResponse.body, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
