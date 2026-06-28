import { describe, expect, it } from 'vitest'
import { componentBoxScale, scaleBoxStyles, scaleCssValue } from './scale.js'

describe('renderer scale helpers', () => {
  it('derives visual scale from the component box area', () => {
    const scale = componentBoxScale(
      { layout: { w: 360, h: 96 } },
      { defaultSize: { w: 180, h: 48 } },
    )

    expect(scale).toBe(2)
  })

  it('uses html snippet metadata instead of the generic html default size', () => {
    const scale = componentBoxScale(
      {
        type: 'html',
        props: {
          _paletteType: 'icon',
          code: '<span style="display:inline-grid;width:100%;height:100%;">+</span>',
        },
        layout: { w: 180, h: 180 },
      },
      { defaultSize: { w: 400, h: 240 } },
    )

    expect(scale).toBe(2)
  })

  it('scales px values inside compound CSS values', () => {
    expect(scaleCssValue('10px 12px', 2)).toBe('20px 24px')
    expect(scaleCssValue('0 0 8px', 1.5)).toBe('0 0 12px')
  })

  it('scales common visual metrics without touching unrelated styles', () => {
    expect(scaleBoxStyles({
      fontSize: '17px',
      padding: '4px 12px',
      borderRadius: '8px',
      color: '#111827',
    }, 2)).toEqual({
      fontSize: '34px',
      padding: '8px 24px',
      borderRadius: '16px',
      color: '#111827',
    })
  })
})
