// Runs after `vite build` (see the "build" script in package.json).
//
// Kollide is a single-page app, so every URL is served the same dist/index.html
// and would give search engines the home page's <head> (title, description,
// canonical) no matter which page they asked for. This writes dist/privacy.html
// and dist/terms.html: copies of index.html with their own head, so /privacy and
// /terms are served with the right title, description and canonical tags. The
// app itself still takes over in the browser as usual.
//
// The files are privacy.html and terms.html, not privacy/index.html, because
// the latter would redirect /privacy to /privacy/ (a trailing slash).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const home = readFileSync(join(dist, 'index.html'), 'utf8')

const pages = [
  {
    file: 'privacy.html',
    path: '/privacy',
    title: 'Privacy Policy · Kollide',
    description:
      'How Kollide collects, uses and protects your data: what we collect, who can see it, how long we keep it and how to delete your account.',
  },
  {
    file: 'terms.html',
    path: '/terms',
    title: 'Terms of Service · Kollide',
    description:
      'The rules for using Kollide: who can join, what Kollide is, the code of conduct, groups, staying safe and how accounts can be ended.',
  },
]

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Replace exactly one match, or stop the build: a silent miss would ship the wrong tags.
function swap(html, pattern, make, label) {
  if (!pattern.test(html)) throw new Error(`seo-pages: could not find ${label} in dist/index.html`)
  return html.replace(pattern, (...m) => make(...m))
}

for (const page of pages) {
  const url = `https://kollide.in${page.path}`
  let html = home
  html = swap(html, /<title>[^<]*<\/title>/, () => `<title>${esc(page.title)}</title>`, '<title>')
  html = swap(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, (_, a, b) => a + esc(page.description) + b, 'description')
  html = swap(html, /(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + url + b, 'canonical')
  html = swap(html, /(<meta property="og:url" content=")[^"]*(")/, (_, a, b) => a + url + b, 'og:url')
  html = swap(html, /(<meta property="og:title" content=")[^"]*(")/, (_, a, b) => a + esc(page.title) + b, 'og:title')
  html = swap(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, (_, a, b) => a + esc(page.description) + b, 'og:description')
  html = swap(html, /(<meta name="twitter:title" content=")[^"]*(")/, (_, a, b) => a + esc(page.title) + b, 'twitter:title')
  html = swap(html, /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, (_, a, b) => a + esc(page.description) + b, 'twitter:description')
  // Home-only: the hero poster preload and the Organization/WebSite schema.
  html = swap(html, /\s*<link rel="preload" as="image"[^>]*>/, () => '', 'hero poster preload')
  html = swap(html, /\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => '', 'JSON-LD')
  writeFileSync(join(dist, page.file), html)
  console.log(`seo-pages: wrote dist/${page.file} (${url})`)
}
