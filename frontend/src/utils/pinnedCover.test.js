// What a pinned bar hides before anyone scrolls.
//
// Pinning a bar takes it out of the page and puts it on the viewport edge.
// Anything drawn under that strip is gone the moment the page opens, and on an
// absolutely positioned page there is no flow to pad — the component keeps its
// coordinates and simply disappears. The editor could not say so, which is how
// you find out after publishing.
import { describe, expect, it } from 'vitest'
import { hiddenByPinnedBar, pinnedTopBar } from './pinnedCover.js'

const bar = (props = {}, layout = { x: 0, y: 40, w: 1000, h: 84 }) => ({
  id: 'nav', type: 'navbar', layout,
  props: { scrollBehavior: 'fixed', pinY: 'top', pinOffsetY: 0, ...props },
})
const box = (id, layout) => ({ id, type: 'html', layout, props: {} })

describe('finding the pinned bar', () => {
  it('finds a fixed top bar', () => {
    expect(pinnedTopBar([bar()])?.id).toBe('nav')
  })

  it('ignores a bar that is not pinned at all', () => {
    expect(pinnedTopBar([bar({ scrollBehavior: 'normal' })])).toBe(null)
  })

  it('ignores a sticky bar', () => {
    // Sticky stays at its design Y until the visitor scrolls. Covering the
    // opening strip is a fixed-bar problem.
    expect(pinnedTopBar([bar({ scrollBehavior: 'sticky' })])).toBe(null)
  })

  it('ignores a bar pinned to the bottom', () => {
    // It hides the end of the page, not its opening — a different complaint.
    expect(pinnedTopBar([bar({ pinY: 'bottom' })])).toBe(null)
  })

  it('ignores a hidden bar', () => {
    expect(pinnedTopBar([{ ...bar(), hidden: true }])).toBe(null)
  })

  it('ignores a bar hidden on the mobile viewport', () => {
    expect(pinnedTopBar([{ ...bar(), hiddenMobile: true }], 'mobileLayout')).toBe(null)
  })

  it('still finds a desktop-hidden bar that is shown on mobile', () => {
    expect(pinnedTopBar([{ ...bar(), hidden: true, hiddenMobile: false }], 'mobileLayout')?.id).toBe('nav')
  })
})

describe('what the bar hides at rest', () => {
  it('says nothing about content below it', () => {
    // The real page this came from: bar resting over 0–84, first element at
    // 191. Nothing is covered until the visitor scrolls, and scrolling under a
    // fixed header is the point of one.
    const components = [bar(), box('pill', { x: 619, y: 191, w: 127, h: 40 })]

    expect(hiddenByPinnedBar(components[1], components)).toBe(0)
  })

  it('measures a component the bar sits on top of', () => {
    const components = [bar(), box('hero', { x: 0, y: 60, w: 600, h: 200 })]

    expect(hiddenByPinnedBar(components[1], components)).toBe(24)
  })

  it('counts a component swallowed whole', () => {
    const components = [bar(), box('tag', { x: 10, y: 10, w: 200, h: 30 })]

    expect(hiddenByPinnedBar(components[1], components)).toBe(30)
  })

  it('uses where the bar LANDS, not where it was drawn', () => {
    // Drawn at y=40, pinned with an offset of 0: it rests over 0–84, so a
    // component at y=10 is hidden even though it sits above the design Y.
    const components = [bar(), box('tag', { x: 0, y: 10, w: 100, h: 20 })]

    expect(hiddenByPinnedBar(components[1], components)).toBe(20)
  })

  it('respects a custom offset', () => {
    const components = [bar({ pinOffsetY: 40 }), box('tag', { x: 0, y: 10, w: 100, h: 20 })]

    expect(hiddenByPinnedBar(components[1], components)).toBe(0)
  })

  it('does not count a component beside the bar', () => {
    // A narrow bar leaves room next to it; overlapping vertical bands are not
    // enough to hide anything.
    const components = [bar({}, { x: 0, y: 0, w: 300, h: 84 }), box('side', { x: 400, y: 10, w: 200, h: 40 })]

    expect(hiddenByPinnedBar(components[1], components)).toBe(0)
  })

  it('never flags the bar against itself', () => {
    const components = [bar()]

    expect(hiddenByPinnedBar(components[0], components)).toBe(0)
  })

  it('says nothing when no bar is pinned', () => {
    const components = [bar({ scrollBehavior: 'normal' }), box('tag', { x: 0, y: 10, w: 100, h: 20 })]

    expect(hiddenByPinnedBar(components[1], components)).toBe(0)
  })

  it('says nothing for a sticky bar sitting over the same pixels', () => {
    const components = [bar({ scrollBehavior: 'sticky' }), box('tag', { x: 0, y: 10, w: 100, h: 20 })]

    expect(hiddenByPinnedBar(components[1], components)).toBe(0)
  })

  it('does not compare nested coordinates against a page-level bar', () => {
    // y=10 here is inside a parent, not on the page. Treating it as page Y
    // would warn about a heading that is actually halfway down the section.
    const nested = box('inner', { x: 0, y: 10, w: 100, h: 20 })
    const components = [bar(), { id: 'section', type: 'container', layout: { x: 0, y: 400, w: 800, h: 300 }, props: {}, children: [nested] }]

    expect(hiddenByPinnedBar(nested, components)).toBe(0)
  })
})
