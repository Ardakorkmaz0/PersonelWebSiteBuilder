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
import { isRtlLanguage, normalizeLanguageTag } from './languages.js'

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
  return normalizeLanguageTag(page?.language)
}

// Reading direction: taken from the language unless the page overrides it —
// a Hebrew page is right-to-left without anyone ticking a box, and a page that
// mixes scripts can still say which way it runs.
export function pageDirection(page) {
  const explicit = String(page?.direction || '').toLowerCase()
  if (explicit === 'rtl' || explicit === 'ltr') return explicit
  return isRtlLanguage(page?.language) ? 'rtl' : 'ltr'
}

// Only written when it is not the browser's own default, so a plain English
// page keeps a clean <html> tag.
export function pageDirAttr(page) {
  const direction = pageDirection(page)
  const explicit = String(page?.direction || '').toLowerCase()
  return direction === 'rtl' || explicit === 'ltr' ? ` dir="${direction}"` : ''
}

export function seoHeadTags(page, fallbackTitle) {
  const title = pageSeoTitle(page, fallbackTitle)
  const description = String(page?.seoDescription || '').trim()
  const image = sanitizeImageSrc(page?.seoImage)
  const rawCanonical = sanitizeUrl(page?.canonicalUrl)
  const canonical = /^(?:https?:\/\/|\/)/i.test(rawCanonical) ? rawCanonical : ''
  const tags = []
  // Tints the browser UI around the page on phones — a #rrggbb value only, so
  // a stored junk string cannot escape the attribute.
  const themeColor = /^#[0-9a-fA-F]{3,8}$/.test(String(page?.themeColor || '').trim())
    ? String(page.themeColor).trim()
    : ''
  if (themeColor) tags.push(`<meta name="theme-color" content="${esc(themeColor)}" />`)
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

// Document-level behaviour the page opts into. Smooth scrolling is wrapped in
// a reduced-motion guard: a visitor who asked the system for less motion gets
// the instant jump, whatever the page prefers.
export function pageBehaviourCss(page) {
  if (!page?.smoothScroll) return ''
  return '@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }'
}

// Inlined in the head rather than added to the shared stylesheet: the setting
// belongs to ONE page, and the multi-file export gives every page the same css.
export function pageBehaviourStyleTag(page) {
  const css = pageBehaviourCss(page)
  return css ? `\n    <style>${css}</style>` : ''
}
