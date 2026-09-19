// The behaviour worth pinning is the arithmetic people actually feel: that a
// chosen percentage means that percentage, that 'fit' is allowed to go above
// 1:1, and that stepping starts from what is on screen.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoom,
  readZoom,
  writeZoom,
  zoomPercent,
  zoomScale,
} from './canvasZoom.js'

beforeEach(() => localStorage.clear())

describe('what the canvas is drawn at', () => {
  it('honours a chosen percentage regardless of the space available', () => {
    // The whole complaint: the canvas used to shrink to fit and the size you
    // set was not the size you got.
    expect(zoomScale(100, 0.62)).toBe(1)
    expect(zoomScale(150, 0.62)).toBe(1.5)
  })

  it('lets fit go above 1:1 on a screen with room to spare', () => {
    // Clamping this at 1 is what left the artboard small in an empty room on a
    // high-resolution display.
    expect(zoomScale('fit', 1.8)).toBe(1.8)
  })

  it('falls back to fit when the stored value is nonsense', () => {
    expect(zoomScale(0, 0.5)).toBe(0.5)
    expect(zoomScale(Number.NaN, 0.5)).toBe(0.5)
  })

  it('survives a fit scale that has not been measured yet', () => {
    expect(zoomScale('fit', 0)).toBe(1)
    expect(zoomScale('fit', undefined)).toBe(1)
  })
})

describe('the number shown on the control', () => {
  it('reports what fit actually landed on, not the word "fit"', () => {
    expect(zoomPercent('fit', 0.62)).toBe(62)
    expect(zoomPercent(125, 0.62)).toBe(125)
  })
})

describe('stepping', () => {
  it('starts from what is on screen when the canvas is on fit', () => {
    // At 62%, "+" must give a little more than 62 — not jump to a remembered
    // step somewhere else.
    expect(nextZoom('fit', 1, 0.62)).toBe(67)
    expect(nextZoom('fit', -1, 0.62)).toBe(50)
  })

  it('walks the steps from an explicit zoom', () => {
    expect(nextZoom(100, 1, 1)).toBe(110)
    expect(nextZoom(100, -1, 1)).toBe(90)
  })

  it('stops at the ends instead of running off them', () => {
    expect(nextZoom(MAX_ZOOM, 1, 1)).toBe(MAX_ZOOM)
    expect(nextZoom(MIN_ZOOM, -1, 1)).toBe(MIN_ZOOM)
  })

  it('never moves the opposite way when fit already lies beyond the last step', () => {
    // A wide artboard in a narrow window fits below the smallest step.
    expect(nextZoom('fit', -1, 0.2)).toBe('fit')
    expect(nextZoom('fit', 1, 0.2)).toBe(MIN_ZOOM)
  })
})

describe('remembering it', () => {
  it('round-trips a step and the fit sentinel', () => {
    writeZoom('k', 125)
    expect(readZoom('k')).toBe(125)
    writeZoom('k', 'fit')
    expect(readZoom('k')).toBe('fit')
  })

  it('reads anything it does not recognise as fit', () => {
    localStorage.setItem('k', '9999')
    expect(readZoom('k')).toBe('fit')
    localStorage.setItem('k', 'banana')
    expect(readZoom('k')).toBe('fit')
  })

  it('defaults to fit when nothing was ever stored', () => {
    expect(readZoom('never-set')).toBe('fit')
  })
})
