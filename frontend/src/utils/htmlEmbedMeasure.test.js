// The measurement itself needs a real layout engine (jsdom reports 0s), so
// the tests pin the SIZING DECISION — the part that decides when a box may
// tighten and how the height snaps to the content.
import { describe, expect, it } from 'vitest'
import { decideFitSize } from './htmlEmbedMeasure.js'

describe('decideFitSize', () => {
  it('keeps the designed width for flowing text (max-content wider than box)', () => {
    const out = decideFitSize({ boxW: 560, measuredH: 96, naturalW: 1400 })
    expect(out.w).toBe(560)
    expect(out.h).toBe(102) // measured + padding
  })

  it('tightens the width for clearly narrower content (container, card)', () => {
    const out = decideFitSize({ boxW: 560, measuredH: 140, naturalW: 430 })
    expect(out.w).toBe(436) // natural + padding
    expect(out.h).toBe(146)
  })

  it('does not tighten for near-full-width content (avoids jitter)', () => {
    const out = decideFitSize({ boxW: 400, measuredH: 100, naturalW: 380 })
    expect(out.w).toBe(400) // 380+6 > 400*0.92 → keep
  })

  it('does not tighten when max-content collapses far below the box (column stacking)', () => {
    // A 3-column pricing grid reports one column's width as max-content;
    // tightening would stack the columns vertically.
    const out = decideFitSize({ boxW: 1000, measuredH: 380, naturalW: 290 })
    expect(out.w).toBe(1000)
  })

  it('never tightens when the caller forbids it (sections are full-width)', () => {
    const out = decideFitSize({ boxW: 1000, measuredH: 380, naturalW: 620, allowTighten: false })
    expect(out.w).toBe(1000)
    expect(out.h).toBe(386)
  })

  it('minRatio 0 lets a lone image hug fully (no stacking risk)', () => {
    const out = decideFitSize({ boxW: 480, measuredH: 120, naturalW: 120, minRatio: 0 })
    expect(out.w).toBe(126)
    expect(out.h).toBe(126)
  })

  it('clamps to sane minimums and maximums', () => {
    expect(decideFitSize({ boxW: 8, measuredH: 4, naturalW: 10 })).toEqual({ w: 20, h: 20 })
    expect(decideFitSize({ boxW: 600, measuredH: 99999, naturalW: 0 }).h).toBe(2400)
  })

  it('survives missing measurements', () => {
    const out = decideFitSize({ boxW: 300, measuredH: 0, naturalW: undefined })
    expect(out).toEqual({ w: 300, h: 20 })
  })
})

describe('decideFitSize painted width', () => {
  // Regression: the ratio guard below refused to shrink exactly the blocks that
  // needed it most. A palette button ships a 220px box around 89px of ink and a
  // badge a 170px box around 42px, so both landed just under the 0.45 threshold
  // and kept a selection frame 2.5-4x wider than the block.
  it('hugs the measured ink even when it is far narrower than the box', () => {
    expect(decideFitSize({ boxW: 220, measuredH: 40, naturalW: 88, paintedW: 83 }).w).toBe(89)
    expect(decideFitSize({ boxW: 170, measuredH: 30, naturalW: 41, paintedW: 36 }).w).toBe(42)
  })

  // A snippet with its own max-width paints the same width no matter how wide
  // the box is; max-content reports the longest word instead and is useless here.
  it('respects a snippet max-width cap', () => {
    expect(decideFitSize({ boxW: 560, measuredH: 139, naturalW: 122, paintedW: 414 }).w).toBe(420)
  })

  // Content that fills its box falls back to the old heuristic, so a multi-column
  // section (whose max-content collapses to one column) still keeps its width.
  it('keeps the box when the content fills it', () => {
    expect(decideFitSize({ boxW: 1000, measuredH: 240, naturalW: 366, paintedW: 1000 }).w).toBe(1000)
  })

  it('never tightens when tightening is switched off', () => {
    expect(
      decideFitSize({ boxW: 440, measuredH: 96, naturalW: 221, paintedW: 120, allowTighten: false }).w,
    ).toBe(440)
  })
})
