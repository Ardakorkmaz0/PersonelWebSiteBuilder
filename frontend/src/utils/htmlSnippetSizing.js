const HTML_SNIPPET_FALLBACK = { w: 380, h: 110 }

const HTML_SNIPPET_SIZE = {
  navbar: { w: 1000, h: 84 },
  section: { w: 1000, h: 240 },
  card: { w: 360, h: 320 },
  image: { w: 480, h: 300 },
  list: { w: 420, h: 112 },
  input: { w: 440, h: 96 },
  button: { w: 220, h: 56 },
  linkbutton: { w: 240, h: 50 },
  badge: { w: 170, h: 44 },
  heading: { w: 620, h: 84 },
  text: { w: 560, h: 120 },
  quote: { w: 560, h: 130 },
  divider: { w: 560, h: 44 },
  select: { w: 360, h: 90 },
  alert: { w: 520, h: 110 },
  accordion: { w: 620, h: 220 },
  tabs: { w: 620, h: 220 },
  container: { w: 560, h: 150 },
  icon: { w: 90, h: 90 },
  html: { w: 560, h: 150 },
  spacer: { w: 560, h: 60 },
}

const HTML_SNIPPET_VARIANT_SIZE = {
  navbar: {
    centered: { w: 640, h: 110 },
    sticky: { w: 720, h: 86 },
    search: { w: 720, h: 86 },
    tworow: { w: 1000, h: 116 },
    vertical: { w: 220, h: 320 },
    'vertical-light': { w: 220, h: 320 },
  },
  html: {
    blank: { w: 560, h: 150 },
    'css-card': { w: 420, h: 180 },
  },
  list: {
    check: { w: 420, h: 112 },
    bulleted: { w: 420, h: 104 },
    numbered: { w: 420, h: 104 },
  },
  section: {
    soft: { w: 1000, h: 220 },
    gradient: { w: 1000, h: 250 },
    split: { w: 1000, h: 460 },
  },
}

function numericSize(size) {
  const w = Number(size?.w)
  const h = Number(size?.h)
  return Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0
    ? { w, h }
    : null
}

export function htmlSnippetSize(type, variant, fallback = HTML_SNIPPET_FALLBACK) {
  const id = typeof variant === 'string' ? variant : variant?.id
  return (
    numericSize(HTML_SNIPPET_VARIANT_SIZE[type]?.[id])
    || numericSize(HTML_SNIPPET_SIZE[type])
    || numericSize(fallback)
    || HTML_SNIPPET_FALLBACK
  )
}

export function isInlineIconSnippet(code) {
  return /display\s*:\s*inline-grid/i.test(String(code || ''))
}

export function isInlineControlSnippet(code) {
  const text = String(code || '').trim()
  if (!text) return false
  if (/^<\s*(?:a|button)\b/i.test(text)) return true
  return /^<\s*span\b/i.test(text) && /display\s*:\s*inline-(?:block|flex|grid)/i.test(text)
}

export function isFormControlSnippet(code) {
  const text = String(code || '').trim()
  if (!text) return false
  return /<\s*(?:input|select|textarea)\b/i.test(text) || /^<\s*label\b/i.test(text)
}

export function htmlEmbedFillMode(component) {
  if (component?.type !== 'html') return ''
  const props = component.props || {}
  const paletteType = props._paletteType || ''
  const code = props.code || ''
  if (paletteType === 'icon' || isInlineIconSnippet(code)) return 'icon'
  if (['button', 'linkbutton', 'badge'].includes(paletteType) || isInlineControlSnippet(code)) {
    return 'control'
  }
  if (['input', 'select'].includes(paletteType) || isFormControlSnippet(code)) return 'form'
  return ''
}

export function htmlEmbedDocumentOptions(component, scale = 1) {
  const fill = htmlEmbedFillMode(component)
  return {
    fill,
    scale: fill ? 1 : scale,
  }
}

export function parseInlineIconSize(code) {
  const text = String(code || '')
  if (!isInlineIconSnippet(text)) return null
  const w = /width\s*:\s*(\d+(?:\.\d+)?)px/i.exec(text)?.[1]
  const h = /height\s*:\s*(\d+(?:\.\d+)?)px/i.exec(text)?.[1]
  return numericSize({ w, h })
}

export function htmlBaseSizeFromComponent(component, fallback) {
  const current = numericSize(fallback)
  if (component?.type !== 'html') return current

  const props = component.props || {}
  const paletteType = props._paletteType
  const paletteVariant = props._paletteVariant
  const code = props.code

  return (
    numericSize(props._baseSize)
    || (paletteType ? htmlSnippetSize(paletteType, paletteVariant, null) : null)
    || parseInlineIconSize(code)
    || (isInlineIconSnippet(code) ? htmlSnippetSize('icon') : null)
    || current
  )
}
