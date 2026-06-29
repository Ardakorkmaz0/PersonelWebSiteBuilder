import { describe, expect, it } from 'vitest'
import { recolorHtml, hasVisibleBackground } from './htmlRecolor.js'

describe('recolorHtml', () => {
  it('recolors a solid button background on fill', () => {
    const code = '<a href="#" style="padding:12px 26px;background:#2563eb;color:#fff;border-radius:10px;">Button</a>'
    const out = recolorHtml(code, '#dc2626', 'fill')
    expect(out).toContain('background:#dc2626')
    expect(out).not.toContain('#2563eb')
    // text color untouched
    expect(out).toContain('color:#fff')
  })

  it('collapses a gradient background to the solid brush color', () => {
    const code = '<a style="background:linear-gradient(90deg,#6366f1,#a855f7);color:#fff;">Button</a>'
    const out = recolorHtml(code, '#16a34a', 'fill')
    expect(out).toContain('background:#16a34a')
    expect(out).not.toContain('linear-gradient')
  })

  it('recolors background-color too', () => {
    const code = '<div style="background-color:#fff;">x</div>'
    expect(recolorHtml(code, '#000000', 'fill')).toContain('background-color:#000000')
  })

  it('recolors text color without touching background-color', () => {
    const code = '<p style="background-color:#fff;color:#475569;">Body</p>'
    const out = recolorHtml(code, '#111111', 'text')
    expect(out).toContain('color:#111111')
    expect(out).toContain('background-color:#fff')
  })

  it('does not match "color" inside "background-color" when recoloring text', () => {
    const code = '<div style="background-color:#abcdef;">x</div>'
    const out = recolorHtml(code, '#123123', 'text')
    // nothing to recolor — the only color-like prop is background-color
    expect(out).toBe(code)
  })

  it('keeps width/style and swaps only the color in a border shorthand', () => {
    const code = '<a style="background:transparent;color:#2563eb;border:2px solid #2563eb;">Outline</a>'
    const out = recolorHtml(code, '#9333ea', 'border')
    expect(out).toContain('border:2px solid #9333ea')
    // border target leaves fill/text alone
    expect(out).toContain('color:#2563eb')
    expect(out).toContain('background:transparent')
  })

  it('recolors rgba border colors', () => {
    const code = '<div style="border:1px solid rgba(34,211,238,0.5);">x</div>'
    const out = recolorHtml(code, '#ff0000', 'border')
    expect(out).toContain('border:1px solid #ff0000')
    expect(out).not.toContain('rgba(34,211,238')
  })

  it('leaves transparent backgrounds alone but injects a root background when none is visible', () => {
    const code = '<h1 style="font-size:52px;color:#0f172a;">Heading</h1>'
    const out = recolorHtml(code, '#2563eb', 'fill')
    expect(out).toContain('background:#2563eb')
  })

  it('smart picks fill for snippets with a visible background', () => {
    const code = '<a style="background:#2563eb;color:#fff;">Button</a>'
    const out = recolorHtml(code, '#dc2626', 'smart')
    expect(out).toContain('background:#dc2626')
    expect(out).toContain('color:#fff')
  })

  it('smart picks text for snippets without a background (headings)', () => {
    const code = '<h1 style="font-size:52px;color:#0f172a;">Heading</h1>'
    const out = recolorHtml(code, '#dc2626', 'smart')
    expect(out).toContain('color:#dc2626')
    // no background was injected on smart→text
    expect(out).not.toContain('background:#dc2626')
  })

  it('does not touch background-clip:text (gradient headings)', () => {
    const code = '<h1 style="background:linear-gradient(90deg,#6366f1,#ec4899);background-clip:text;color:transparent;">Gradient</h1>'
    const out = recolorHtml(code, '#000000', 'text')
    // color:transparent is skipped, background-clip untouched
    expect(out).toContain('background-clip:text')
    expect(out).toContain('color:transparent')
  })

  it('recolors every colored surface in a multi-element navbar on fill', () => {
    const code = '<nav style="background:#0f172a;"><a style="background:#2563eb;color:#fff;">Sign up</a></nav>'
    const out = recolorHtml(code, '#10b981', 'fill')
    expect(out).not.toContain('#0f172a')
    expect(out).not.toContain('#2563eb')
    expect((out.match(/background:#10b981/g) || []).length).toBe(2)
  })

  it('returns the input unchanged for empty/invalid code', () => {
    expect(recolorHtml('', '#fff', 'fill')).toBe('')
    expect(recolorHtml(null, '#fff', 'fill')).toBe(null)
  })

  it('hasVisibleBackground detects visible vs transparent', () => {
    expect(hasVisibleBackground('<a style="background:#2563eb;">x</a>')).toBe(true)
    expect(hasVisibleBackground('<a style="background:transparent;color:#fff;">x</a>')).toBe(false)
    expect(hasVisibleBackground('<h1 style="color:#000;">x</h1>')).toBe(false)
  })
})
