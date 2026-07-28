// Search + social <head> tags for one page.
//
// ONE source of truth: the three writers (schemaToFiles' pageHtml and
// schemaToScaledHtml, plus responsiveHtml) all call this, so a page cannot get
// meta tags in one export and not another — the drift that bit navbar layout and
// motion earlier in this codebase.
//
// Values are escaped here and the image is passed through the same allowlist as
// any user image. An EMPTY field emits no tag at all: an empty og:image or a
// blank description is worse than none, because scrapers show the empty result.
import { sanitizeImageSrc, sanitizeUrl } from './sanitize.js'

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  )
}

// The <title> a page publishes with: its SEO title when set, else the name the
// export was called with.
export function pageSeoTitle(page, fallback) {
  const explicit = String(page?.seoTitle || '').trim()
  return explicit || String(fallback || '')
}

export function pageLanguage(page) {
  return page?.language === 'tr' ? 'tr' : 'en'
}

export function seoHeadTags(page, fallbackTitle) {
  const title = pageSeoTitle(page, fallbackTitle)
  const description = String(page?.seoDescription || '').trim()
  const image = sanitizeImageSrc(page?.seoImage)
  const rawCanonical = sanitizeUrl(page?.canonicalUrl)
  const canonical = /^(?:https?:\/\/|\/)/i.test(rawCanonical) ? rawCanonical : ''
  const tags = []
  if (page?.noIndex) tags.push('<meta name="robots" content="noindex, nofollow" />')
  if (canonical) {
    tags.push(`<link rel="canonical" href="${esc(canonical)}" />`)
    tags.push(`<meta property="og:url" content="${esc(canonical)}" />`)
  }
  if (description) {
    tags.push(`<meta name="description" content="${esc(description)}" />`)
    tags.push(`<meta property="og:description" content="${esc(description)}" />`)
    tags.push(`<meta name="twitter:description" content="${esc(description)}" />`)
  }
  if (title) {
    tags.push(`<meta property="og:title" content="${esc(title)}" />`)
    tags.push(`<meta name="twitter:title" content="${esc(title)}" />`)
  }
  if (image) {
    tags.push(`<meta property="og:image" content="${esc(image)}" />`)
    // Without this a link preview renders as a small thumbnail beside the text
    // rather than the large card the image was chosen for.
    tags.push('<meta name="twitter:card" content="summary_large_image" />')
  } else if (title || description) {
    tags.push('<meta name="twitter:card" content="summary" />')
  }
  if (tags.length) tags.push('<meta property="og:type" content="website" />')
  return tags.join('\n    ')
}
