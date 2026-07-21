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

describe('pinnedLayoutStyle full-height vertical navbar', () => {
  it('stretches a fixed vertical navbar into a Twitter-like side rail', () => {
    const style = pinnedLayoutStyle(
      {
        type: 'navbar',
        props: { navLayout: 'vertical', scrollBehavior: 'fixed', pinX: 'left' },
      },
      { position: 'absolute', left: 0, top: 0, width: 220, height: 320 },
    )
    expect(style.position).toBe('fixed')
    expect(style.top).toBe(0)
    expect(style.bottom).toBe(0)
    expect(style.height).toBe('auto')
    expect(style.left).toBe(0)
  })

  it('supports the right side and keeps a custom top offset', () => {
    const style = pinnedLayoutStyle(
      {
        type: 'navbar',
        props: { navLayout: 'vertical', scrollBehavior: 'fixed', pinX: 'right', pinOffsetY: 12 },
      },
      { position: 'absolute', left: 0, top: 0, width: 220, height: 320 },
    )
    expect(style.right).toBe(0)
    expect(style.top).toBe(12)
    expect(style.bottom).toBe(0)
    expect(style.height).toBe('auto')
  })

  it('does not stretch horizontal navbars or sticky vertical ones', () => {
    const horizontal = pinnedLayoutStyle(
      { type: 'navbar', props: { navLayout: 'horizontal', scrollBehavior: 'fixed' } },
      { position: 'absolute', left: 0, top: 0, width: 1000, height: 70 },
    )
    expect(horizontal.height).toBe(70)
    const stickyVertical = pinnedLayoutStyle(
      { type: 'navbar', props: { navLayout: 'vertical', scrollBehavior: 'sticky' } },
      { position: 'absolute', left: 0, top: 0, width: 220, height: 320 },
    )
    expect(stickyVertical.height).toBe(320)
    expect(stickyVertical.bottom).toBeUndefined()
  })
})

describe('pinnedLayoutStyle Bootstrap fixed-top navbar', () => {
  it('keeps a full-width horizontal navbar edge-to-edge, ignoring stray offsets', () => {
    const style = pinnedLayoutStyle(
      {
        type: 'navbar',
        props: { scrollBehavior: 'fixed', pinOffsetX: 24, pinOffsetY: 0 },
      },
      { position: 'absolute', left: 0, top: 0, width: '100%', height: 70 },
    )
    expect(style.position).toBe('fixed')
    expect(style.left).toBe(0)
    expect(style.right).toBe(0)
    expect(style.width).toBe('100%')
    expect(style.top).toBe(0)
  })

  it('leaves a boxed navbar at its designed x', () => {
    const style = pinnedLayoutStyle(
      {
        type: 'navbar',
        props: { scrollBehavior: 'fixed', widthMode: 'boxed', pinOffsetX: 120 },
      },
      { position: 'absolute', left: 120, top: 0, width: 700, height: 70 },
    )
    expect(style.left).toBe(120)
    expect(style.right).toBeUndefined()
    expect(style.width).toBe(700)
  })
})

describe('pinnedLayoutStyle rail inset for the fixed top bar', () => {
  const bar = { type: 'navbar', props: { scrollBehavior: 'fixed' } }
  const base = { position: 'absolute', left: 0, top: 0, width: '100%', height: 70 }

  it('starts the bar after a fixed LEFT rail so its brand clears the rail', () => {
    const style = pinnedLayoutStyle(bar, base, { left: 220, right: 0 })
    expect(style.left).toBe(220)
    expect(style.right).toBe(0)
    expect(style.width).toBe('auto')
  })

  it('reserves room for a right-side rail too', () => {
    const style = pinnedLayoutStyle(bar, base, { left: 0, right: 260 })
    expect(style.left).toBe(0)
    expect(style.right).toBe(260)
    expect(style.width).toBe('auto')
  })

  it('stays edge-to-edge when there is no rail', () => {
    expect(pinnedLayoutStyle(bar, base, { left: 0, right: 0 }).width).toBe('100%')
    expect(pinnedLayoutStyle(bar, base).width).toBe('100%')
  })
})
