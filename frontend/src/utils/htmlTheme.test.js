// Deterministic recolor: the quick-action palette must swap CSS variables
// without touching anything else, and must signal (null) when the document
// has no recognizable color variables so the caller falls back to the AI.
import { describe, expect, it } from 'vitest'
import {
  THEME_SWATCHES,
  applyPaletteToHtml,
  applyThemeToDocument,
  injectThemeFont,
  replaceDominantColors,
} from './htmlTheme.js'

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

describe('applyThemeToDocument', () => {
  const THEME = {
    primaryColor: '#e8543f',
    textColor: '#27201e',
    backgroundColor: '#fffaf7',
    softColor: '#fcefe9',
    fontFamily: '"Poppins", system-ui, sans-serif',
  }

  it('maps theme fields onto a wide set of CSS variable names', () => {
    const doc = '<head><style>:root{--accent:#000;--ink:#222;--bg:#fff;--soft:#eee}</style></head><body>x</body>'
    const out = applyThemeToDocument(doc, THEME)
    expect(out).toContain('--accent:#e8543f')
    expect(out).toContain('--ink:#27201e')
    expect(out).toContain('--bg:#fffaf7')
    expect(out).toContain('--soft:#fcefe9')
  })

  it('injects a font override + Google Font link', () => {
    const out = applyThemeToDocument('<head></head><body>x</body>', THEME)
    expect(out).toContain('data-pwb-theme-font')
    expect(out).toContain('Poppins')
    expect(out).toContain('fonts.googleapis.com')
  })

  it('recolors dominant brand colors when the page has no variables', () => {
    const doc = '<head><style>.btn{background:#1d4ed8}.a{color:#1d4ed8}</style></head><body>hi</body>'
    const out = applyThemeToDocument(doc, { primaryColor: '#e8543f' })
    expect(out).toContain('#e8543f')
    expect(out).not.toContain('#1d4ed8')
  })

  it('is idempotent — re-applying does not stack font blocks', () => {
    const once = applyThemeToDocument('<head></head><body>x</body>', THEME)
    const twice = applyThemeToDocument(once, THEME)
    const count = (s) => (s.match(/data-pwb-theme-font/g) || []).length
    expect(count(twice)).toBe(count(once))
  })

  it('returns null for empty input', () => {
    expect(applyThemeToDocument('', THEME)).toBeNull()
    expect(applyThemeToDocument('<body>x</body>', null)).toBeNull()
  })
})

describe('injectThemeFont', () => {
  it('strips a previous injection before adding the new one', () => {
    const a = injectThemeFont('<head></head><body></body>', '"Inter", sans-serif')
    const b = injectThemeFont(a, '"Lora", serif')
    expect(b).toContain('Lora')
    expect(b).not.toContain('Inter')
  })

  it('removes its block entirely when given no font', () => {
    const a = injectThemeFont('<head></head><body></body>', '"Inter", sans-serif')
    const b = injectThemeFont(a, '')
    expect(b).not.toContain('data-pwb-theme-font')
  })
})
