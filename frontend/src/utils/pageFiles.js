// File-name flavored label for a page in an HTML-mode site: the first page
// publishes as index.html, the rest are slugified from the page name.
export function pageFileName(page, isHome) {
  if (isHome) return 'index.html'
  const slug = String(page?.name || 'page')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${slug || 'page'}.html`
}
