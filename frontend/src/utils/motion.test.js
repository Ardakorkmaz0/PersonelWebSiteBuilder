import { describe, expect, it } from 'vitest'
import {
  resolveMotion,
  motionClassSuffix,
  motionRevealAttr,
  motionCssVars,
  pageHasMotion,
  MOTION_CSS,
  MOTION_ARM_JS,
  MOTION_OBSERVER_JS,
  REVEAL_TYPES,
  motionHeadTags,
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

describe('motion safety contract', () => {
  // The hidden start state must be opt-in, gated on a class the observer script
  // adds. Without JS nothing is ever hidden — an element stranded at opacity:0
  // is content the visitor simply cannot see.
  it('only hides revealed elements under the armed class', () => {
    expect(MOTION_CSS).toContain('.pwb-anim-armed [data-anim-in]{opacity:0}')
    // The bare attribute selector must not hide anything on its own.
    expect(MOTION_CSS).not.toMatch(/(^|\n)\[data-anim-in\]\{[^}]*opacity:0/)
  })

  it('arms in the head and reveals on a later frame, so the transition can play', () => {
    // Arming must happen before the body paints; if the hidden state and the
    // reveal land in one frame the browser has nothing to interpolate and the
    // animation silently does nothing.
    expect(MOTION_ARM_JS).toContain("' pwb-anim-armed'")
    expect(motionHeadTags()).toContain('data-builder-motion-arm')
    expect(motionHeadTags()).toContain('[data-anim-in]')
    expect(MOTION_OBSERVER_JS).toMatch(/requestAnimationFrame\(function\(\)\{requestAnimationFrame/)
    // An arm nobody claims disarms itself, so a blocked observer cannot leave
    // the page blank.
    expect(MOTION_ARM_JS).toContain('__pwbMotion')
    expect(MOTION_OBSERVER_JS).toContain('window.__pwbMotion=1')
  })

  it('never leaves content hidden when it cannot be revealed', () => {
    // No IntersectionObserver, or nothing to animate → disarm entirely.
    expect(MOTION_OBSERVER_JS).toContain("if(!('IntersectionObserver' in window)){disarm();return;}")
    expect(MOTION_OBSERVER_JS).toContain('if(!els.length){disarm();return;}')
    // The sweep re-checks after layout settles and covers a non-scrolling page,
    // where a below-fold element could never be scrolled into view.
    expect(MOTION_OBSERVER_JS).toContain('function sweep()')
    expect(MOTION_OBSERVER_JS).toContain('onScreen||!scrollable')
    expect(MOTION_OBSERVER_JS).toContain("addEventListener('resize',sweep)")
  })

  it('ships a start state for every reveal type it offers', () => {
    for (const type of REVEAL_TYPES) {
      if (type === 'none' || type === 'fade') continue // fade needs opacity only
      expect(MOTION_CSS, `${type} has no armed start state`)
        .toContain(`.pwb-anim-armed [data-anim-in="${type}"]`)
    }
  })

  it('accepts the extended catalog', () => {
    for (const type of ['zoom-out', 'flip', 'rotate', 'blur', 'bounce', 'wipe']) {
      expect(resolveMotion({ animIn: type })?.reveal).toBe(type)
    }
    for (const hover of ['sink', 'tilt']) {
      expect(resolveMotion({ animHover: hover })?.hover).toBe(hover)
    }
  })
})
