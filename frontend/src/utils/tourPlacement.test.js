import { describe, expect, it } from 'vitest'
import { placeCard, usableSteps } from './tourPlacement.js'

const viewport = { width: 1200, height: 800 }
const card = { width: 320, height: 180 }
const rect = (left, top, width, height) => ({
  left, top, width, height, right: left + width, bottom: top + height,
})

describe('placeCard', () => {
  it('sits under the target and centres on it', () => {
    const place = placeCard(rect(400, 100, 200, 40), viewport, card)
    expect(place.placement).toBe('below')
    expect(place.top).toBe(152)
    expect(place.left).toBe(340)
  })

  it('goes above when there is no room below', () => {
    const place = placeCard(rect(400, 700, 200, 40), viewport, card)
    expect(place.placement).toBe('above')
    expect(place.top).toBe(508)
  })

  it('goes beside a target that fills the height', () => {
    const place = placeCard(rect(0, 0, 240, 800), viewport, card)
    expect(place.placement).toBe('right')
    expect(place.left).toBe(252)
  })

  it('never hangs off the edge', () => {
    const place = placeCard(rect(1150, 100, 40, 40), viewport, card)
    expect(place.left).toBe(870)
    expect(place.left + card.width).toBeLessThanOrEqual(viewport.width)

    const atStart = placeCard(rect(0, 100, 40, 40), viewport, card)
    expect(atStart.left).toBe(10)
  })

  it('centres itself when there is nothing to point at', () => {
    expect(placeCard(null, viewport, card)).toEqual({ top: 310, left: 440, placement: 'center' })
    expect(placeCard(rect(0, 0, 0, 0), viewport, card).placement).toBe('center')
  })
})

describe('usableSteps', () => {
  // The editor is two workspaces in one; a step about a panel this mode does
  // not have would be a card pointing at nothing.
  it('drops the steps whose target is not on screen', () => {
    const steps = [
      { id: 'a', target: '[data-tour="a"]' },
      { id: 'b', target: '[data-tour="b"]' },
      { id: 'c' },
    ]
    const present = new Set(['[data-tour="b"]'])

    expect(usableSteps(steps, (selector) => present.has(selector)).map((step) => step.id))
      .toEqual(['b', 'c'])
  })

  it('survives an empty list', () => {
    expect(usableSteps(null, () => true)).toEqual([])
  })
})
