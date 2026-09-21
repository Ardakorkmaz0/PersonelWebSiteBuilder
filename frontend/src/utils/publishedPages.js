// What a publish actually sends: every page, rendered to a document.
//
// A published site used to be a schema plus the app's own shell, so what a
// visitor received said "Sitebuilder" in its head and drew the page with
// JavaScript afterwards. The writers already produce the real document — the
// in-app viewer renders component pages through schemaToSingleHtml, and an
// uploaded page IS its document — so publishing just has to hand those over.

import { schemaToSingleHtml } from './schemaToFiles.js'
import { pageSeoTitle } from './seoTags.js'

// The address of a page under /s/<slug>/. The home page has none: it IS the
// site. The server slugifies and de-duplicates again, so this is the wish, not
// the guarantee.
// Dotless ı has no canonical decomposition, so NFKD alone drops it and
// "Çalışmalar" becomes "cal-smalar". The letters that matter most here are
// mapped by hand; NFKD then handles the accents of every other language.
const TRANSLITERATE = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ç: 'c', Ç: 'c', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u', ß: 'ss', æ: 'ae', ø: 'o', å: 'a', đ: 'd', ł: 'l' }

export function pagePath(page, index) {
  if (index === 0) return ''
  const slug = String(page?.name || '')
    .trim()
    .replace(/[^ -]/g, (char) => TRANSLITERATE[char] ?? char)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `page-${index + 1}`
}

// A link to another page is stored as `#<pageId>` — the fragment the in-app
// viewer understands. Served as a real page that link goes nowhere, so the
// schema is retargeted to the addresses the pages are about to have. Done to
// the schema rather than to the rendered HTML so every writer inherits it.
export function publishedHref(slug, path) {
  return path ? `/s/${slug}/${path}/` : `/s/${slug}/`
}

function retarget(value, links) {
  if (Array.isArray(value)) return value.map((item) => retarget(item, links))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, inner] of Object.entries(value)) {
      out[key] = key === 'href' && typeof inner === 'string' && links.has(inner)
        ? links.get(inner)
        : retarget(inner, links)
    }
    return out
  }
  return value
}

export function withPublishedLinks(schema, links) {
  if (!links.size) return schema
  const pages = (Array.isArray(schema?.pages) ? schema.pages : []).map((page) => ({
    ...page,
    components: retarget(page.components, links),
  }))
  return { ...schema, pages }
}

// One page's document: its own file when it was uploaded, otherwise the export
// the viewer already shows.
export function pageDocument(page, schema, siteTitle, htmlMap = {}) {
  const authored = htmlMap[page?.id]
  if (typeof authored === 'string' && authored.trim()) return authored
  const title = pageSeoTitle(page, page?.name || siteTitle || 'My Site')
  try {
    return schemaToSingleHtml({ ...schema, pages: [page] }, title)
  } catch {
    // A page the writer cannot render must not take the whole publish down;
    // it simply is not served until it renders.
    return ''
  }
}

export function publishedPagesFor(schema, htmlMap = {}, siteTitle = '', slug = '') {
  const pages = Array.isArray(schema?.pages) ? schema.pages : []
  const paths = pages.map((page, index) => pagePath(page, index))
  // Only with a slug: without one there is no address to point a link at, and
  // a half-rewritten link is worse than the fragment it replaced.
  const links = new Map(
    slug ? pages.map((page, index) => [`#${page.id}`, publishedHref(slug, paths[index])]) : [],
  )
  const linked = withPublishedLinks(schema, links)

  return pages
    .map((page, index) => ({
      path: paths[index],
      title: pageSeoTitle(page, page?.name || siteTitle || 'My Site').slice(0, 200),
      html: pageDocument(linked.pages[index], linked, siteTitle, htmlMap),
      noIndex: !!page?.noIndex,
    }))
    .filter((page) => page.html)
}
