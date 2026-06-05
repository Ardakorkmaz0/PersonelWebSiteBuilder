// Sanitize is the front-end's first XSS defence — wherever a user-controlled
// URL, image source, or style object flows into the DOM, these helpers run
// first. Backend validators.py mirrors the same logic and is the authoritative
// gate; the front-end copy keeps the editor preview from rendering hostile
// content even before the schema round-trips through Django.
import { describe, expect, it } from 'vitest'
import {
  sanitizeUrl,
  sanitizeImageSrc,
  sanitizeStyles,
} from './sanitize.js'

describe('sanitizeUrl', () => {
  it('returns empty for non-strings', () => {
    expect(sanitizeUrl(null)).toBe('')
    expect(sanitizeUrl(undefined)).toBe('')
    expect(sanitizeUrl(123)).toBe('')
    expect(sanitizeUrl({})).toBe('')
  })

  it('trims whitespace', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com')
    expect(sanitizeUrl('   ')).toBe('')
  })

  it('preserves anchor and absolute paths verbatim', () => {
    expect(sanitizeUrl('#contact')).toBe('#contact')
    expect(sanitizeUrl('#')).toBe('#')
    expect(sanitizeUrl('/login')).toBe('/login')
    expect(sanitizeUrl('/sites/abc?page=1')).toBe('/sites/abc?page=1')
  })

  it('accepts safe schemes', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com')
    expect(sanitizeUrl('mailto:hi@example.com')).toBe('mailto:hi@example.com')
    expect(sanitizeUrl('tel:+15551234')).toBe('tel:+15551234')
  })

  it('blocks dangerous schemes (case-insensitive)', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('JavaScript:alert(1)')).toBe('')
    expect(sanitizeUrl('vbscript:msgbox()')).toBe('')
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(sanitizeUrl('file:///etc/passwd')).toBe('')
  })

  it('blocks unknown protocols (anything with ://) but keeps simple relative paths', () => {
    expect(sanitizeUrl('ftp://example.com')).toBe('')
    expect(sanitizeUrl('gopher://example.com')).toBe('')
    expect(sanitizeUrl('page.html')).toBe('page.html')
    expect(sanitizeUrl('./about')).toBe('./about')
  })
})

describe('sanitizeImageSrc', () => {
  it('falls through to sanitizeUrl for non-data URLs', () => {
    expect(sanitizeImageSrc('https://example.com/x.png')).toBe(
      'https://example.com/x.png',
    )
    expect(sanitizeImageSrc('javascript:alert(1)')).toBe('')
  })

  it('accepts data:image/* base64 within size cap', () => {
    const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA='
    expect(sanitizeImageSrc(tiny)).toBe(tiny)
  })

  it('rejects data:image/* with invalid format', () => {
    expect(sanitizeImageSrc('data:image/png;base64,not!valid!')).toBe('')
    expect(sanitizeImageSrc('data:image/exe;base64,abcd')).toBe('')
  })

  it('rejects oversized data: URLs (>5MB)', () => {
    // 5MB + 1 byte of valid base64 chars
    const oversized = 'data:image/png;base64,' + 'A'.repeat(5 * 1024 * 1024 + 1)
    expect(sanitizeImageSrc(oversized)).toBe('')
  })

  it('rejects non-image data: URLs even if they look like data:', () => {
    expect(sanitizeImageSrc('data:text/html;base64,abcd')).toBe('')
    expect(sanitizeImageSrc('data:application/javascript,alert(1)')).toBe('')
  })
})

describe('sanitizeStyles', () => {
  it('returns empty object for non-objects', () => {
    expect(sanitizeStyles(null)).toEqual({})
    expect(sanitizeStyles('color: red')).toEqual({})
    expect(sanitizeStyles(123)).toEqual({})
  })

  it('drops style values containing dangerous CSS', () => {
    const cleaned = sanitizeStyles({
      color: 'red',
      backgroundImage: 'url(http://evil.com/x.png)',
      filter: 'expression(alert(1))',
      cursor: 'pointer',
    })
    // url() (any) and expression() are blocked. Plain values keep going.
    expect(cleaned.color).toBe('red')
    expect(cleaned.cursor).toBe('pointer')
    expect(cleaned.backgroundImage).toBeUndefined()
    expect(cleaned.filter).toBeUndefined()
  })

  it('drops javascript: anywhere in a value', () => {
    const cleaned = sanitizeStyles({
      backgroundColor: 'javascript:alert(1)',
      color: '#fff',
    })
    expect(cleaned.backgroundColor).toBeUndefined()
    expect(cleaned.color).toBe('#fff')
  })

  it('drops keys not in the allow-list (no transition, animation, content, …)', () => {
    const cleaned = sanitizeStyles({
      color: 'red',
      transition: 'all 1s',
      animation: 'spin 2s',
      content: '"x"',
    })
    expect(cleaned.color).toBe('red')
    expect(cleaned.transition).toBeUndefined()
    expect(cleaned.animation).toBeUndefined()
    expect(cleaned.content).toBeUndefined()
  })
})
