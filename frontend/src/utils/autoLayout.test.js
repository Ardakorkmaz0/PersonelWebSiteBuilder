import { describe, expect, it } from 'vitest'
import {
  autoLayoutChildCss,
  autoLayoutChildStyle,
  autoLayoutContainerCss,
  autoLayoutContainerStyle,
  isAutoLayout,
} from './autoLayout.js'

describe('isAutoLayout', () => {
  it('is true only for a known flow mode', () => {
    expect(isAutoLayout({ flow: 'column' })).toBe(true)
    expect(isAutoLayout({ flow: 'row' })).toBe(true)
    expect(isAutoLayout({ flow: 'grid' })).toBe(true)
    expect(isAutoLayout({ flow: 'free' })).toBe(false)
    expect(isAutoLayout({})).toBe(false)
    expect(isAutoLayout(null)).toBe(false)
  })
})

describe('autoLayoutContainerStyle', () => {
  it('returns null for a free container', () => {
    expect(autoLayoutContainerStyle({ flow: 'free' })).toBeNull()
  })

  it('builds a flex column with gap/justify/align', () => {
    expect(autoLayoutContainerStyle({ flow: 'column', gap: 24, justify: 'center', align: 'start' })).toEqual({
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      justifyContent: 'center',
      alignItems: 'flex-start',
      flexWrap: 'nowrap',
    })
  })

  it('wraps a row when asked', () => {
    const s = autoLayoutContainerStyle({ flow: 'row', wrap: true })
    expect(s.flexDirection).toBe('row')
    expect(s.flexWrap).toBe('wrap')
    expect(s.gap).toBe('16px') // default
  })

  it('builds a clamped grid template', () => {
    expect(autoLayoutContainerStyle({ flow: 'grid', cols: 99 }).gridTemplateColumns)
      .toBe('repeat(12, minmax(0, 1fr))')
    expect(autoLayoutContainerStyle({ flow: 'grid' }).gridTemplateColumns)
      .toBe('repeat(3, minmax(0, 1fr))')
  })
})

describe('autoLayoutChildStyle', () => {
  const img = { type: 'image', layout: { w: 120, h: 120 } }
  const text = { type: 'text', layout: { w: 300, h: 60 } }

  it('column stretch fills width; fixed types keep height, content grows', () => {
    expect(autoLayoutChildStyle(img, { flow: 'column', align: 'stretch' })).toMatchObject({
      width: '100%', height: '120px',
    })
    expect(autoLayoutChildStyle(text, { flow: 'column', align: 'stretch' })).toMatchObject({
      width: '100%', height: 'auto', minHeight: '60px',
    })
  })

  it('column non-stretch keeps the designed width', () => {
    expect(autoLayoutChildStyle(img, { flow: 'column', align: 'center' }).width).toBe('120px')
  })

  it('row keeps designed width and never grows', () => {
    expect(autoLayoutChildStyle(img, { flow: 'row' })).toMatchObject({ flex: '0 1 auto', width: '120px' })
  })

  it('grid children fill their cell', () => {
    expect(autoLayoutChildStyle(text, { flow: 'grid' })).toMatchObject({ width: '100%', minWidth: 0 })
  })

  it('returns null for a free container', () => {
    expect(autoLayoutChildStyle(img, { flow: 'free' })).toBeNull()
  })
})

describe('css serialization', () => {
  it('emits kebab-case inline css for export', () => {
    const css = autoLayoutContainerCss({ flow: 'column', gap: 12 })
    expect(css).toContain('display:flex')
    expect(css).toContain('flex-direction:column')
    expect(css).toContain('gap:12px')
    expect(css).toContain('justify-content:flex-start')
  })

  it('child css drops empty values', () => {
    const css = autoLayoutChildCss({ type: 'image', layout: { w: 120, h: 120 } }, { flow: 'grid' })
    expect(css).toContain('width:100%')
    expect(css).toContain('min-width:0')
    expect(css).not.toContain('undefined')
  })

  it('is empty for a free container', () => {
    expect(autoLayoutContainerCss({ flow: 'free' })).toBe('')
  })
})
