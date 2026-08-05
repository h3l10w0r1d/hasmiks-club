// Post-build static-HTML snapshot for the public marketing routes.
//
// Vite builds a pure client-rendered SPA (`dist/index.html` is just
// `<div id="root"></div>` + a script tag) — fine for logged-in app usage,
// useless for anything that doesn't execute JavaScript: Facebook/WhatsApp/
// Telegram link-preview scrapers, most AI crawlers, and a plain `curl`.
// This script serves the just-built `dist/` locally, visits each public
// route in a real headless browser, waits for React (and react-helmet-async,
// which mutates <head> directly) to finish rendering, and writes the
// resulting full DOM as a static `index.html` at that route's path —
// Vercel's filesystem check runs before its rewrites, so a real file here
// wins over vercel.json's SPA catch-all automatically. The client bundle
// still loads and hydrates normally on top of the static markup for actual
// visitors; this only changes what a non-JS request sees.
//
// Deliberately a small custom script rather than a community Vite-prerender
// plugin — those tend to lag brand-new major Vite versions (this project is
// on Vite 8), and this way every step is something we can debug directly
// against a build we can't live-test on Vercel's own infrastructure.
import http from 'node:http'
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Vercel's `vercel build` container has no root/apt access, so the full
// `playwright-chromium` package's bundled browser fails to launch there
// (missing shared libs like libnspr4.so — there's no way to apt-get them
// in). `@sparticuz/chromium` ships a statically-linked Chromium built
// specifically for exactly this kind of constrained serverless/build
// environment, paired with the lighter `playwright-core` (same driver,
// no bundled browser download). Locally (any dev machine, any OS) the
// full `playwright-chromium` package already works out of the box and
// sparticuz's Linux-only binary wouldn't even execute — so branch on
// Vercel's own `VERCEL` build-time env var rather than always using one.
async function launchBrowser() {
  if (process.env.VERCEL) {
    const [{ chromium }, { default: sparticuzChromium }] = await Promise.all([
      import('playwright-core'),
      import('@sparticuz/chromium'),
    ])
    return chromium.launch({
      args: sparticuzChromium.args,
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    })
  }
  const { chromium } = await import('playwright-chromium')
  return chromium.launch()
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const SITE_URL = 'https://www.hasmiksclub.am'
const API_URL = process.env.VITE_API_URL || 'https://hasmiks-club.onrender.com'

const STATIC_ROUTES = ['/', '/events', '/about', '/contact', '/terms', '/gift', '/login', '/register']

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
}

// Read once, before any route is captured, and reused as the SPA fallback
// for every route below — NOT re-read from disk on each request. Route "/"
// itself writes its rendered snapshot to dist/index.html as soon as it's
// captured (see writeRouteHtml), which would otherwise poison the fallback
// every later route in this same pass falls back to: that snapshot already
// has "/"'s own Helmet-rendered title/meta baked in as plain tags (no
// data-default marker for main.jsx's cleanup to find), so every subsequent
// route would silently inherit them instead of getting a clean slate.
const pristineShell = readFileSync(join(DIST, 'index.html'), 'utf-8')

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0])
      let filePath = join(DIST, urlPath)
      const isPageRequest = urlPath.endsWith('/') || !extname(urlPath)
      if (isPageRequest) {
        filePath = join(filePath, 'index.html')
        // Client-side routes with no prerendered snapshot yet (this pass is
        // what creates those snapshots) fall back to the pristine shell,
        // same as Vercel's own SPA rewrite does in production.
        if (!existsSync(filePath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(pristineShell)
          return
        }
      }
      if (!existsSync(filePath)) {
        res.writeHead(404).end('Not found')
        return
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
      createReadStream(filePath).pipe(res)
    })
    // A fixed port, not an ephemeral one (listen(0, ...)) — the browser's
    // fetch() calls (e.g. EventDetailPage loading /events/public/:id from
    // the real API) run cross-origin against the backend, which enforces a
    // CORS allowlist. A random port could never be added to that allowlist
    // ahead of time, silently breaking any page whose content depends on a
    // fetch. The backend's ALLOWED_ORIGINS must include this exact origin
    // (http://127.0.0.1:4174) for prerendering to see real data.
    server.listen(4174, '127.0.0.1', () => resolve(server))
  })
}

async function fetchEventIds() {
  try {
    const res = await fetch(`${API_URL}/events/public`)
    if (!res.ok) throw new Error(`${res.status}`)
    const events = await res.json()
    return events.map((e) => e.id)
  } catch (err) {
    console.warn(`[prerender] Could not fetch public events from ${API_URL} (${err.message}) — skipping /events/:id snapshots this build.`)
    return []
  }
}

function writeRouteHtml(route, html) {
  const outDir = route === '/' ? DIST : join(DIST, route.replace(/^\//, ''))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), html)
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('[prerender] dist/index.html not found — run `vite build` first.')
    process.exit(1)
  }

  const eventIds = await fetchEventIds()
  const routes = [...STATIC_ROUTES, ...eventIds.map((id) => `/events/${id}`)]

  const server = await startStaticServer()
  const port = server.address().port

  let browser
  try {
    browser = await launchBrowser()
  } catch (err) {
    // Prerendering is a progressive enhancement on top of the SPA vite
    // build that already succeeded above — a broken headless-browser
    // environment (a new Vercel build-image change, a version mismatch,
    // etc.) should degrade to shipping the plain SPA, exactly what shipped
    // before this script existed, never fail the whole deploy.
    console.warn(`[prerender] Could not launch a browser (${err.message}) — shipping the SPA build without prerendered routes.`)
    server.close()
    return
  }

  // One shared context + page for the whole run, navigated fresh per route
  // via page.goto() (a real HTTP navigation each time, so main.jsx's
  // data-default cleanup and every page's own script still run fresh —
  // reusing the page doesn't leave anything stale). Opening/closing a new
  // BrowserContext per route was tried first and is what shipped in an
  // earlier commit, but @sparticuz/chromium's Vercel build launches with
  // --single-process/--no-zygote, and repeatedly tearing down contexts
  // under those flags crashed the whole browser process after the very
  // first route — an uncaught rejection that took the entire build down
  // with it. A single long-lived context sidesteps that instability.
  const prerendered = []
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()
    for (const route of routes) {
      try {
        await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle', timeout: 20000 })
        // React Router + data fetching settle asynchronously after the
        // network goes idle (e.g. a page's own useEffect firing off a
        // second request once the first resolves) — a short fixed wait
        // is simpler and more reliable here than trying to enumerate every
        // page's specific loading-complete signal.
        await page.waitForTimeout(1000)
        const html = await page.content()
        // An /events/:id page that can't load its own data (e.g. the
        // backend's CORS allowlist rejects this static server's origin —
        // see startStaticServer's ALLOWED_ORIGINS note) silently renders
        // its "event not found" empty state instead of throwing, which
        // would otherwise sail through as a genuine-looking prerendered
        // snapshot: actively wrong, misleading content baked in for a real
        // event. Skip publishing those rather than shipping a false 404.
        if (/^\/events\/\d+$/.test(route) && !/<link rel="canonical"/.test(html)) {
          console.warn(`[prerender] ${route} rendered its not-found state (likely blocked by CORS) — skipping, not publishing false content.`)
          continue
        }
        writeRouteHtml(route, html)
        prerendered.push(route)
        console.log(`[prerender] ${route}`)
      } catch (err) {
        console.warn(`[prerender] Failed on ${route}: ${err.message} — leaving the SPA fallback for this route.`)
        // A closed/crashed browser fails every remaining goto() the same
        // way — stop the loop instead of burning the 20s timeout on each
        // of the rest, but still fall through to write a sitemap for
        // whatever did succeed and let the build finish successfully.
        if (browser.isConnected && !browser.isConnected()) break
      }
    }
  } catch (err) {
    // Catches failures in the one-time context/page setup itself (not
    // covered by the per-route try above) — same fail-soft contract as
    // launchBrowser(): never let a browser-automation problem fail the
    // build that vite already finished successfully.
    console.warn(`[prerender] Browser session failed (${err.message}) — shipping what was captured so far.`)
  } finally {
    try { await context?.close() } catch { /* already gone */ }
    try { await browser.close() } catch { /* already gone */ }
    server.close()
  }

  const today = new Date().toISOString().slice(0, 10)
  const urls = prerendered
    .map((route) => `  <url>\n    <loc>${SITE_URL}${route === '/' ? '/' : route}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join('\n')
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  writeFileSync(join(DIST, 'sitemap.xml'), sitemap)

  console.log(`[prerender] Done — ${prerendered.length}/${routes.length} routes snapshotted, sitemap.xml written.`)
}

main()
