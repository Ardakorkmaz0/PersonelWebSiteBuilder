import { readElementMultilineText, writeElementMultilineText } from './domMultilineText.js'

const HTML_SELECTOR = 'h1,h2,h3,p,a,button,img'
const COMPONENT_FIELDS = ['text', 'title', 'subtitle', 'label', 'description', 'alt', 'src']

function parseHtml(html) {
  if (!html?.trim() || typeof DOMParser === 'undefined') return null
  try { return new DOMParser().parseFromString(html, 'text/html') } catch { return null }
}

function componentEntries(page, components, parentPath = [], result = []) {
  ;(components || []).forEach((component, index) => {
    const path = [...parentPath, index]
    for (const field of COMPONENT_FIELDS) {
      const value = component.props?.[field]
      if (typeof value !== 'string' || (!value.trim() && field !== 'alt')) continue
      result.push({
        id: `component:${page.id}:${path.join('.')}:${field}`,
        source: 'component', pageId: page.id, pageName: page.name,
        path, field, value,
        label: `${component.type || 'component'} · ${field}`,
      })
    }
    componentEntries(page, component.children, path, result)
  })
  return result
}

export function extractSiteContent(schema = {}, pageHtmlMap = {}) {
  const result = []
  for (const page of schema.pages || []) {
    const html = pageHtmlMap[page.id] ?? page.html ?? ''
    if (page.mode === 'html' || html.trim()) {
      const doc = parseHtml(html)
      ;[...(doc?.querySelectorAll(HTML_SELECTOR) || [])].forEach((node, index) => {
        const isImage = node.tagName === 'IMG'
        const field = isImage ? 'alt' : 'text'
        const value = isImage ? node.getAttribute('alt') || '' : readElementMultilineText(node)
        if (!value.trim() && !isImage) return
        result.push({
          id: `html:${page.id}:${index}:${field}`,
          source: 'html', pageId: page.id, pageName: page.name,
          index, field, value,
          label: isImage ? 'Image alternative text' : node.tagName.toLowerCase(),
        })
      })
      continue
    }
    componentEntries(page, page.components, [], result)
  }
  return result
}

export function updateHtmlContent(html, entry, value) {
  const doc = parseHtml(html)
  const node = doc?.querySelectorAll(HTML_SELECTOR)?.[entry.index]
  if (!doc || !node) return html
  if (entry.field === 'alt') node.setAttribute('alt', value)
  else writeElementMultilineText(node, value)
  return '<!doctype html>\n' + doc.documentElement.outerHTML
}

export function updateSchemaContent(schema, entry, value) {
  const next = structuredClone(schema)
  const page = next.pages?.find((item) => item.id === entry.pageId)
  if (!page) return schema
  let items = page.components || []
  let component = null
  for (const index of entry.path || []) {
    component = items[index]
    if (!component) return schema
    items = component.children || []
  }
  component.props = { ...(component.props || {}), [entry.field]: value }
  return next
}
