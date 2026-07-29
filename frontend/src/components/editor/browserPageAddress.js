// How a preview frame names a page and turns it into a URL. Shared by the
// desktop window (BrowserFrame) and the phone browser (MobileBrowserChrome) so
// the same page reads the same way in both.

export function pageTitle(page, fallback) {
  return String(page?.seoTitle || page?.name || fallback || 'Untitled page').trim()
}

export function pagePath(page, index) {
  if (index === 0) return '/'
  const source = String(page?.slug || page?.name || `page-${index + 1}`)
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  return `/${source || `page-${index + 1}`}`
}

export function visiblePageAddress(address, page, index) {
  const raw = String(address || 'preview.sitebuilder.local')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
  // A canonical URL already has a path. A bare domain receives the path of the
  // selected design page so the address bar behaves like a real browser.
  return raw.includes('/') ? raw : `${raw}${pagePath(page, index)}`
}
