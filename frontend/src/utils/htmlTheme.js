// Deterministic theme recoloring for HTML sites. When the document declares
// its palette as CSS custom properties (our templates and most AI output do),
// swapping the variable values restyles the whole site instantly — no AI
// round-trip, no risk of the model rewriting content. Returns null when no
// known variable is found, so callers can fall back to an AI restyle prompt.

// Variable names seen across our templates + typical AI output.
const PRIMARY_VARS = ['accent', 'accent-color', 'primary', 'primary-color', 'brand', 'brand-color', 'main-color']
const SECONDARY_VARS = ['secondary', 'secondary-color', 'accent-2', 'accent2']

const varPattern = (name) => new RegExp(`(--${name}\\s*:\\s*)[^;}{]+`, 'gi')

// #rgb / #rrggbb → [h, s, l] each 0..1. Returns null for malformed input.
function hexToHsl(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return null
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let hue
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) hue = ((b - r) / d + 2) / 6
  else hue = ((r - g) / d + 4) / 6
  return [hue, s, l]
}

// Fallback for documents WITHOUT recognizable color variables: find the
// dominant saturated ("accent-looking") hex colors used in the page and
// replace them literally. Grays/whites/blacks are excluded so text and
// backgrounds survive; only the brand colors swap. Returns null when the
// page has no saturated colors to swap.
export function replaceDominantColors(html, colors) {
  const list = (colors || []).filter(Boolean)
  if (!list.length) return null
  const out = String(html || '')
  const counts = new Map()
  for (const m of out.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const lit = m[0].toLowerCase()
    const hsl = hexToHsl(lit)
    if (!hsl) continue
    const [, s, l] = hsl
    if (s < 0.25 || l < 0.12 || l > 0.88) continue // neutral — leave alone
    counts.set(lit, (counts.get(lit) || 0) + 1)
  }
  if (!counts.size) return null
  // Most-used saturated literal → primary; next distinct hue → secondary.
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lit]) => lit)
  let result = out
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  result = result.replace(new RegExp(esc(ranked[0]), 'gi'), list[0])
  if (list[1]) {
    const h0 = hexToHsl(ranked[0])[0]
    const second = ranked.slice(1).find((lit) => {
      const h = hexToHsl(lit)[0]
      return Math.min(Math.abs(h - h0), 1 - Math.abs(h - h0)) > 0.08
    })
    if (second) result = result.replace(new RegExp(esc(second), 'gi'), list[1])
  }
  return result
}

export function applyPaletteToHtml(html, colors) {
  const list = (colors || []).filter(Boolean)
  if (!list.length) return null
  let out = String(html || '')
  let touched = false
  const swap = (names, value) => {
    for (const n of names) {
      const next = out.replace(varPattern(n), (m, p1) => `${p1}${value}`)
      if (next !== out) {
        out = next
        touched = true
      }
    }
  }
  swap(PRIMARY_VARS, list[0])
  // Soft tint derived from the primary — templates use it for chips/badges.
  swap(['accent-soft'], `${list[0]}1f`)
  if (list[1]) swap(SECONDARY_VARS, list[1])
  if (touched) return out
  // No variables — recolor the dominant saturated colors instead, so the
  // palette picker works on ANY page (imported or AI-generated).
  return replaceDominantColors(out, list)
}

// Curated swatches for the quick-action palette — first selection becomes the
// primary, second (optional) the secondary.
export const THEME_SWATCHES = [
  ['#4f46e5', 'Indigo'], ['#2563eb', 'Blue'], ['#0e7490', 'Teal'], ['#0d9488', 'Emerald'],
  ['#166534', 'Forest'], ['#65a30d', 'Lime'], ['#eab308', 'Gold'], ['#f59e0b', 'Amber'],
  ['#e8543f', 'Coral'], ['#dc2626', 'Red'], ['#db2777', 'Pink'], ['#86198f', 'Plum'],
  ['#7c3aed', 'Violet'], ['#0f172a', 'Navy'], ['#111111', 'Black'], ['#9a6b4f', 'Mocha'],
]
