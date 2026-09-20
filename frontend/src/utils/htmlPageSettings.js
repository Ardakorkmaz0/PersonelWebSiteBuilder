// Page settings for an UPLOADED page, where the document is the truth.
//
// A component page keeps its language, direction and search metadata in the
// schema and the writers put them in the head. An HTML page has no schema to
// read: whatever the document says IS the setting, so the panel has to read it
// from there and write it back — otherwise the controls sit next to a page they
// do not touch, which is exactly how it behaved before this module existed.

import { normalizeLanguageTag } from './languages.js'

const SMOOTH_MARKER = 'data-pwb-smooth-scroll'
const SMOOTH_CSS = '@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }'

function parse(html) {
  if (typeof DOMParser === 'undefined') return null
  try {
    const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html')
    return doc?.documentElement ? doc : null
  } catch {
    return null
  }
}

function serialize(doc, original) {
  if (!doc?.documentElement) return String(original ?? '')
  const doctype = /^\s*<!doctype/i.test(String(original ?? '')) ? '<!DOCTYPE html>\n' : ''
  return doctype + doc.documentElement.outerHTML
}

function metaContent(doc, name) {
  return doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || ''
}

// What the document currently says. Unset fields come back empty/false, which
// is what an unset control shows.
export function readHtmlPageSettings(html) {
  const doc = parse(html)
  if (!doc) return { language: 'en', direction: '', themeColor: '', smoothScroll: false, noIndex: false, canonicalUrl: '', seoTitle: '', seoDescription: '' }
  const root = doc.documentElement
  const direction = (root.getAttribute('dir') || '').toLowerCase()
  const robots = metaContent(doc, 'robots').toLowerCase()
  return {
    language: normalizeLanguageTag(root.getAttribute('lang')),
    direction: direction === 'rtl' || direction === 'ltr' ? direction : '',
    themeColor: metaContent(doc, 'theme-color'),
    smoothScroll: !!doc.querySelector(`style[${SMOOTH_MARKER}]`),
    noIndex: robots.includes('noindex'),
    canonicalUrl: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
    seoTitle: doc.querySelector('title')?.textContent || '',
    seoDescription: metaContent(doc, 'description'),
  }
}

function head(doc) {
  if (!doc.head) doc.documentElement.prepend(doc.createElement('head'))
  return doc.head
}

function setMeta(doc, name, value) {
  const existing = doc.querySelector(`meta[name="${name}"]`)
  if (!value) {
    existing?.remove()
    return
  }
  if (existing) {
    existing.setAttribute('content', value)
    return
  }
  const meta = doc.createElement('meta')
  meta.setAttribute('name', name)
  meta.setAttribute('content', value)
  head(doc).append(meta)
}

// Writes only the keys the patch carries, so one control never clears another's
// tag. Returns the original document untouched when nothing could be parsed.
export function applyHtmlPageSettings(html, patch = {}) {
  const doc = parse(html)
  if (!doc) return String(html ?? '')
  const root = doc.documentElement

  if ('language' in patch) root.setAttribute('lang', normalizeLanguageTag(patch.language))

  if ('direction' in patch) {
    const direction = String(patch.direction || '').toLowerCase()
    if (direction === 'rtl' || direction === 'ltr') root.setAttribute('dir', direction)
    else root.removeAttribute('dir')
  }

  if ('themeColor' in patch) {
    const color = /^#[0-9a-fA-F]{3,8}$/.test(String(patch.themeColor || '').trim())
      ? String(patch.themeColor).trim()
      : ''
    setMeta(doc, 'theme-color', color)
  }

  if ('smoothScroll' in patch) {
    doc.querySelectorAll(`style[${SMOOTH_MARKER}]`).forEach((node) => node.remove())
    if (patch.smoothScroll) {
      const style = doc.createElement('style')
      style.setAttribute(SMOOTH_MARKER, '')
      style.textContent = SMOOTH_CSS
      head(doc).append(style)
    }
  }

  if ('noIndex' in patch) setMeta(doc, 'robots', patch.noIndex ? 'noindex, nofollow' : '')

  if ('canonicalUrl' in patch) {
    const href = String(patch.canonicalUrl || '').trim()
    const existing = doc.querySelector('link[rel="canonical"]')
    if (!href) existing?.remove()
    else if (existing) existing.setAttribute('href', href)
    else {
      const link = doc.createElement('link')
      link.setAttribute('rel', 'canonical')
      link.setAttribute('href', href)
      head(doc).append(link)
    }
  }

  if ('seoTitle' in patch) {
    const value = String(patch.seoTitle || '')
    let title = doc.querySelector('title')
    if (!value) title?.remove()
    else {
      if (!title) {
        title = doc.createElement('title')
        head(doc).append(title)
      }
      title.textContent = value
    }
  }

  if ('seoDescription' in patch) setMeta(doc, 'description', String(patch.seoDescription || ''))

  return serialize(doc, html)
}
