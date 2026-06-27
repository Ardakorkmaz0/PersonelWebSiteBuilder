import { describe, expect, it } from 'vitest'
import { pinnedLayoutStyle } from './layout.js'

describe('pinnedLayoutStyle', () => {
  it('pins fixed components to the selected viewport edges', () => {
    const style = pinnedLayoutStyle(
      {
        props: {
          scrollBehavior: 'fixed',
          pinY: 'bottom',
          pinX: 'right',
          pinOffsetY: 18,
          pinOffsetX: 24,
          pinZIndex: 120,
        },
      },
      { position: 'absolute', left: 10, top: 20, width: 180, height: 48 },
    )

    expect(style).toMatchObject({
      position: 'fixed',
      right: 24,
      bottom: 18,
      width: 180,
      height: 48,
      zIndex: 120,
    })
    expect(style.left).toBeUndefined()
    expect(style.top).toBeUndefined()
  })

  it('centers sticky components when requested', () => {
    const style = pinnedLayoutStyle(
      {
        props: {
          scrollBehavior: 'sticky',
          pinX: 'center',
          pinOffsetX: 8,
        },
      },
      { position: 'relative', width: '100%' },
    )

    expect(style.position).toBe('sticky')
    expect(style.top).toBe(0)
    expect(style.left).toBe('calc(50% + 8px)')
    expect(style.transform).toBe('translateX(-50%)')
  })

  it('uses the current layout position when fixed offsets are missing', () => {
    const style = pinnedLayoutStyle(
      {
        props: {
          scrollBehavior: 'fixed',
        },
      },
      { position: 'absolute', left: 72, top: 144, width: 260, height: 64 },
    )

    expect(style.position).toBe('fixed')
    expect(style.left).toBe(72)
    expect(style.top).toBe(144)
  })
})
