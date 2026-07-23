import { describe, expect, it } from 'vitest'
import {
  resolveMotion,
  motionClassSuffix,
  motionRevealAttr,
  motionCssVars,
  pageHasMotion,
} from './motion.js'

describe('resolveMotion', () => {
  it('returns null when there is no motion', () => {
    expect(resolveMotion({})).toBeNull()
    expect(resolveMotion({ animIn: 'none', animHover: 'none' })).toBeNull()
  })

  it('normalizes reveal, hover, speed and delay', () => {
    const m = resolveMotion({ animIn: 'fade-up', animHover: 'lift', animSpeed: 'slow', animDelay: 120 })
    expect(m).toEqual({ reveal: 'fade-up', hover: 'lift', durationMs: 1150, delayMs: 120 })
  })

  it('clamps a junk delay and falls back on junk enums', () => {
    const m = resolveMotion({ animIn: 'fade', animSpeed: 'warp', animDelay: 99999 })
    expect(m.durationMs).toBe(750) // 'normal'
    expect(m.delayMs).toBe(3000)
  })

  // A pinned bar is positioned by an inline runtime transform that would fight
  // a motion transform, so motion is refused there.
  it('refuses motion on a pinned component', () => {
    expect(resolveMotion({ animIn: 'fade', scrollBehavior: 'fixed' })).toBeNull()
    expect(resolveMotion({ animHover: 'lift', scrollBehavior: 'sticky' })).toBeNull()
  })
})

describe('motion serializers', () => {
  it('emits hover classes and a reveal attribute', () => {
    expect(motionClassSuffix({ animHover: 'grow' })).toBe(' pwb-hover pwb-hover-grow')
    expect(motionClassSuffix({ animIn: 'fade' })).toBe('') // reveal is not a class
    expect(motionRevealAttr({ animIn: 'zoom' })).toBe(' data-anim-in="zoom"')
    expect(motionRevealAttr({ animHover: 'lift' })).toBe('') // hover is not the attr
  })

  it('exposes speed and delay as CSS variables only when revealing', () => {
    expect(motionCssVars({ animIn: 'fade', animSpeed: 'fast', animDelay: 200 })).toEqual({
      '--pwb-anim-dur': '450ms',
      '--pwb-anim-delay': '200ms',
    })
    expect(motionCssVars({ animHover: 'lift' })).toEqual({})
  })
})

describe('pageHasMotion', () => {
  it('detects motion anywhere in the tree, including children', () => {
    expect(pageHasMotion({ components: [{ props: {} }] })).toBe(false)
    expect(pageHasMotion({ components: [{ props: { animHover: 'lift' } }] })).toBe(true)
    expect(pageHasMotion({
      components: [{ props: {}, children: [{ props: { animIn: 'fade-up' } }] }],
    })).toBe(true)
    // A pinned component's motion does not count — it is refused.
    expect(pageHasMotion({
      components: [{ props: { animIn: 'fade', scrollBehavior: 'fixed' } }],
    })).toBe(false)
  })
})
