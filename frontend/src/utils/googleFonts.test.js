// The Google Fonts helpers feed the editor canvas, the live preview, the
// single-file export, and the responsive export — every place where a
// regression would mean the published page renders a different font from
// what the user picked. These tests pin the URL shape and the auto-detect
// logic so that contract doesn't drift.
import { describe, expect, it } from 'vitest'
import {
  GOOGLE_FONTS,
  findFontByName,
  googleFontHref,
  googleFontHrefForTheme,
  googleFontLinkTag,
} from './googleFonts.js'

describe('GOOGLE_FONTS catalogue', () => {
  it('includes the obvious essentials in each category', () => {
    const names = GOOGLE_FONTS.map((f) => f.name)
    expect(names).toContain('Inter')
    expect(names).toContain('Playfair Display')
    expect(names).toContain('JetBrains Mono')
    expect(names).toContain('Bebas Neue')
  })

  it('every font ships a non-empty fallback stack and weights string', () => {
    for (const font of GOOGLE_FONTS) {
      expect(font.name, `${font.name} missing name`).toBeTruthy()
      expect(font.stack, `${font.name} missing stack`).toMatch(/[a-z]/i)
      expect(font.weights, `${font.name} missing weights`).toMatch(/^\d/)
    }
  })

  it('every fallback stack starts with the font name in quotes', () => {
    // Browsers pick the first font that loads — quoted-name-first means the
    // Google file (if it loads) always wins, and the unquoted system fonts
    // kick in only when Fonts is blocked.
    for (const font of GOOGLE_FONTS) {
      const quoted = `"${font.name}"`
      expect(
        font.stack.startsWith(quoted),
        `${font.name} stack must lead with the quoted family name`,
      ).toBe(true)
    }
  })
})

describe('googleFontHref', () => {
  it('builds a display=swap URL for a known font', () => {
    const inter = findFontByName('Inter')
    const url = googleFontHref(inter)
    expect(url).toContain('fonts.googleapis.com/css2?family=Inter:wght@')
    expect(url).toContain('display=swap')
  })

  it('percent-encodes multi-word family names with a + (Google\'s convention)', () => {
    const url = googleFontHref(findFontByName('Playfair Display'))
    expect(url).toContain('family=Playfair+Display:wght@')
  })

  it('returns empty string for falsy / nameless input', () => {
    expect(googleFontHref(null)).toBe('')
    expect(googleFontHref({})).toBe('')
  })
})

describe('googleFontHrefForTheme', () => {
  it('matches a quoted family name (the picker output)', () => {
    const theme = { fontFamily: '"Inter", system-ui, sans-serif' }
    expect(googleFontHrefForTheme(theme)).toContain('family=Inter:wght@')
  })

  it('matches an unquoted legacy font family string', () => {
    // Some older themes were saved without quotes; still expect a hit.
    const theme = { fontFamily: 'Inter, sans-serif' }
    expect(googleFontHrefForTheme(theme)).toContain('family=Inter:wght@')
  })

  it('returns "" when the theme references only system fonts', () => {
    const theme = { fontFamily: 'system-ui, -apple-system, sans-serif' }
    expect(googleFontHrefForTheme(theme)).toBe('')
  })

  it('accepts a plain string too (not just a theme dict)', () => {
    expect(googleFontHrefForTheme('"Playfair Display", Georgia, serif')).toContain('Playfair+Display')
    expect(googleFontHrefForTheme('')).toBe('')
    expect(googleFontHrefForTheme(undefined)).toBe('')
  })

  it('does not match a font name that happens to be a substring of a larger word', () => {
    // "Sans" appears as a substring inside "Plus Jakarta Sans" — naive
    // contains() would over-match. Use a regex word/quote boundary.
    const theme = { fontFamily: 'sans-serif' }
    expect(googleFontHrefForTheme(theme)).toBe('')
  })
})

describe('googleFontLinkTag', () => {
  it('emits preconnect + stylesheet tags when the theme uses a Google Font', () => {
    const tag = googleFontLinkTag({ fontFamily: '"Inter", sans-serif' })
    expect(tag).toContain('preconnect')
    expect(tag).toContain('fonts.googleapis.com')
    expect(tag).toContain('fonts.gstatic.com')
    expect(tag).toContain('rel="stylesheet"')
    expect(tag).toContain('family=Inter')
  })

  it('emits empty string for system fonts (no network request)', () => {
    expect(googleFontLinkTag({ fontFamily: 'system-ui, sans-serif' })).toBe('')
  })
})
