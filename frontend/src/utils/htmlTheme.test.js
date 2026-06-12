// Deterministic recolor: the quick-action palette must swap CSS variables
// without touching anything else, and must signal (null) when the document
// has no recognizable color variables so the caller falls back to the AI.
import { describe, expect, it } from 'vitest'
import { THEME_SWATCHES, applyPaletteToHtml } from './htmlTheme.js'

const DOC = `<!DOCTYPE html><html><head><style>
:root { --accent:#4f46e5; --accent-soft:rgba(79,70,229,0.1); --ink:#111; }
.btn { background: var(--accent); }
</style></head><body><h1>Keep me</h1></body></html>`

describe('applyPaletteToHtml', () => {
  it('swaps the primary variable and derives the soft tint', () => {
    const out = applyPaletteToHtml(DOC, ['#e8543f'])
    expect(out).toContain('--accent:#e8543f')
    expect(out).toContain('--accent-soft:#e8543f1f')
    expect(out).toContain('Keep me') // content untouched
    expect(out).toContain('--ink:#111') // unrelated vars untouched
  })

  it('maps a second color onto secondary-style variables', () => {
    const doc = `<style>:root{ --primary-color: blue; --secondary: green; }</style>`
    const out = applyPaletteToHtml(doc, ['#111111', '#0e7490'])
    expect(out).toContain('--primary-color: #111111')
    expect(out).toContain('--secondary: #0e7490')
  })

  it('returns null when no known color variable exists (AI fallback)', () => {
    expect(applyPaletteToHtml('<style>body{color:red}</style>', ['#fff'])).toBeNull()
    expect(applyPaletteToHtml(DOC, [])).toBeNull()
  })

  it('ships a usable swatch list', () => {
    expect(THEME_SWATCHES.length).toBeGreaterThanOrEqual(12)
    for (const [hex] of THEME_SWATCHES) expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
