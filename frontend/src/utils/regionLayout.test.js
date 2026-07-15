import { describe, expect, it } from 'vitest'
import {
  regionDisplayPatchToDesign,
  responsiveRegionChildLayout,
  resolveRegionDock,
} from './regionLayout.js'

const child = (dockX, layout = { x: 100, y: 24, w: 200, h: 60 }) => ({
  props: dockX ? { dockX } : {},
  layout,
  mobileLayout: { x: 16, y: 32, w: 320, h: 72 },
})

describe('responsive region docking', () => {
  it('keeps edge margins and center offsets when the full-width section grows', () => {
    expect(responsiveRegionChildLayout(child('left'), 1000, 1200)).toEqual({ x: 100, y: 24, w: 200, h: 60 })
    expect(responsiveRegionChildLayout(child('right', { x: 700, y: 24, w: 200, h: 60 }), 1000, 1200))
      .toEqual({ x: 900, y: 24, w: 200, h: 60 })
    expect(responsiveRegionChildLayout(child('center', { x: 400, y: 24, w: 200, h: 60 }), 1000, 1200))
      .toEqual({ x: 500, y: 24, w: 200, h: 60 })
  })

  it('stretches between stable left and right margins', () => {
    expect(responsiveRegionChildLayout(child('stretch', { x: 80, y: 10, w: 840, h: 50 }), 1000, 1200))
      .toEqual({ x: 80, y: 10, w: 1040, h: 50 })
  })

  it('uses an independent readable mobile layout without scaling it', () => {
    expect(responsiveRegionChildLayout(child('right'), 1000, 390, 'mobile'))
      .toEqual({ x: 16, y: 32, w: 320, h: 72 })
  })

  it('infers auto docking and maps responsive drags back to design coordinates', () => {
    const right = child(null, { x: 700, y: 24, w: 200, h: 60 })
    expect(resolveRegionDock(right, 1000)).toBe('right')
    expect(regionDisplayPatchToDesign(right, { x: 900 }, { x: 900, w: 200 }, 1000, 1200))
      .toEqual({ x: 700 })
  })
})
