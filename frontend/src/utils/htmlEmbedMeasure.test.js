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

  it('tightens the width for clearly narrower content (button, badge, card)', () => {
    const out = decideFitSize({ boxW: 560, measuredH: 48, naturalW: 180 })
    expect(out.w).toBe(186) // natural + padding
    expect(out.h).toBe(54)
  })

  it('does not tighten for near-full-width content (avoids jitter)', () => {
    const out = decideFitSize({ boxW: 400, measuredH: 100, naturalW: 380 })
    expect(out.w).toBe(400) // 380+6 > 400*0.92 → keep
  })

  it('clamps to sane minimums and maximums', () => {
    expect(decideFitSize({ boxW: 20, measuredH: 4, naturalW: 10 })).toEqual({ w: 80, h: 36 })
    expect(decideFitSize({ boxW: 600, measuredH: 99999, naturalW: 0 }).h).toBe(2400)
  })

  it('survives missing measurements', () => {
    const out = decideFitSize({ boxW: 300, measuredH: 0, naturalW: undefined })
    expect(out).toEqual({ w: 300, h: 36 })
  })
})
