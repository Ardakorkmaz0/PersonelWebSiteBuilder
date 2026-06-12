// Deterministic theme recoloring for HTML sites. When the document declares
// its palette as CSS custom properties (our templates and most AI output do),
// swapping the variable values restyles the whole site instantly — no AI
// round-trip, no risk of the model rewriting content. Returns null when no
// known variable is found, so callers can fall back to an AI restyle prompt.

// Variable names seen across our templates + typical AI output.
const PRIMARY_VARS = ['accent', 'accent-color', 'primary', 'primary-color', 'brand', 'brand-color', 'main-color']
const SECONDARY_VARS = ['secondary', 'secondary-color', 'accent-2', 'accent2']

const varPattern = (name) => new RegExp(`(--${name}\\s*:\\s*)[^;}{]+`, 'gi')

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
  return touched ? out : null
}

// Curated swatches for the quick-action palette — first selection becomes the
// primary, second (optional) the secondary.
export const THEME_SWATCHES = [
  ['#4f46e5', 'Indigo'], ['#2563eb', 'Blue'], ['#0e7490', 'Teal'], ['#0d9488', 'Emerald'],
  ['#166534', 'Forest'], ['#65a30d', 'Lime'], ['#eab308', 'Gold'], ['#f59e0b', 'Amber'],
  ['#e8543f', 'Coral'], ['#dc2626', 'Red'], ['#db2777', 'Pink'], ['#86198f', 'Plum'],
  ['#7c3aed', 'Violet'], ['#0f172a', 'Navy'], ['#111111', 'Black'], ['#9a6b4f', 'Mocha'],
]
