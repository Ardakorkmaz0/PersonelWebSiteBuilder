// Shared palette data for the two placement surfaces: the compact sidebar rail
// (drag / tap-to-place) and the BlockLibrary overlay (discovery with search).
// ONE visual library powers both editor modes. Pure data/helpers — components
// stay in their own files so react-refresh keeps working.
import { paletteItems } from '../registry.jsx'
import { htmlVariantsFor } from '../../utils/htmlVariants.js'
import { htmlSnippetSize } from '../../utils/htmlSnippetSizing.js'
import { componentToHtml } from '../../utils/componentToHtml.js'

// Variants for a type, with a synthesized "Default" snippet for the types that
// have no curated variants yet (so every component is still placeable).
export function variantsForType(type) {
  const vs = htmlVariantsFor(type)
  return vs.length ? vs : [{ id: 'default', label: 'Default', html: componentToHtml(type) }]
}

// Most palette variants drop as editable HTML embeds on the free canvas, but
// structural widgets that need editor-owned children stay native there.
export const NATIVE_CANVAS_TYPES = new Set(['tabs', 'navbar', 'region'])
// The `region` type is a Wix-like Section: a full-width band that auto-stacks
// below the previous one, never overlaps, reorders, and holds freely-placed
// children — so a page can be built as a stack of sections. It leads the
// palette as the primary structural block; all types stay addable.
export const ADDABLE_PALETTE_ITEMS = [
  ...paletteItems.filter((item) => item.type === 'region'),
  ...paletteItems.filter((item) => item.type !== 'region'),
]

// Types whose snippets are wide (full-width-ish) — previewed scaled-down from the
// top-left; the rest are inline and shown a bit larger, centered.
export const WIDE_HTML = new Set(['navbar', 'section', 'region', 'card', 'image', 'list', 'input', 'select', 'alert', 'accordion', 'tabs', 'container', 'html', 'spacer'])

export function htmlSize(type, variant) {
  const id = typeof variant === 'string' ? variant : variant?.id
  const size = htmlSnippetSize(type, id)
  return [size.w, size.h]
}

// Natural size per section block, so the dropped frame matches the content's real
// height (no dead space below) — keyed by block id, all ~full-width.
const BLOCK_SIZE = {
  hero: [1000, 420], 'hero-split': [1000, 460], features: [1000, 280], stats: [1000, 170],
  pricing: [1000, 380], logos: [1000, 140], testimonial: [1000, 220], faq: [1000, 360],
  contact: [1000, 460], cta: [1000, 220], footer: [1000, 150],
}
export function blockSize(id) {
  return BLOCK_SIZE[id] || [1000, 360]
}

export function previewSrcDoc(html, wide) {
  const body = wide
    ? `<div class="stage stage-wide">${html}</div>`
    : `<div class="stage stage-inline">${html}</div>`
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111827;overflow:hidden}body{padding:12px}.stage-wide{width:920px;transform:scale(.2);transform-origin:top left}.stage-inline{min-height:108px;display:grid;place-items:center}img,video,svg,canvas{max-width:100%;height:auto}</style></head><body>${body}</body></html>`
}
