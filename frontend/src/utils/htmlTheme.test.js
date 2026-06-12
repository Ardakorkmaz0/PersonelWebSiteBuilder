// Deterministic recolor: the quick-action palette must swap CSS variables
// without touching anything else, and must signal (null) when the document
// has no recognizable color variables so the caller falls back to the AI.
import { describe, expect, it } from 'vitest'
import { THEME_SWATCHES, applyPaletteToHtml, replaceDominantColors } from './htmlTheme.js'

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

  it('falls back to dominant-color replacement when no variables exist', () => {
    // No --accent style vars, but a clearly dominant saturated brand color.
    const doc = `<style>.btn{background:#e8543f}.link{color:#e8543f}.muted{color:#6b7280}</style><body><a class="btn">Go</a></body>`
    const out = applyPaletteToHtml(doc, ['#2563eb'])
    expect(out).toContain('#2563eb')
    expect(out).not.toContain('#e8543f')
    expect(out).toContain('#6b7280') // neutral gray untouched
  })

  it('returns null when nothing recolorable exists', () => {
    expect(applyPaletteToHtml('<style>body{color:#111111}</style>', ['#ffffff'])).toBeNull()
    expect(applyPaletteToHtml(DOC, [])).toBeNull()
  })

  it('ships a usable swatch list', () => {
    expect(THEME_SWATCHES.length).toBeGreaterThanOrEqual(12)
    for (const [hex] of THEME_SWATCHES) expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('replaceDominantColors', () => {
  it('maps the two most-used distinct hues onto primary + secondary', () => {
    const doc = `<style>
      .a{color:#e8543f}.b{background:#e8543f}.c{border-color:#e8543f}
      .d{color:#0e7490}.e{background:#0e7490}
      .text{color:#374151}
    </style>`
    const out = replaceDominantColors(doc, ['#111827', '#86198f'])
    expect(out).not.toContain('#e8543f')
    expect(out).not.toContain('#0e7490')
    expect(out).toContain('#86198f')
    expect(out).toContain('#374151') // near-neutral kept
  })

  it('returns null for pages with only neutral colors', () => {
    expect(replaceDominantColors('<style>p{color:#fafafa;background:#101010}</style>', ['#f00'])).toBeNull()
  })
})
