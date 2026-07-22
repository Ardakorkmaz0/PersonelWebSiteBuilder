// The bar is drawn by three separate renderers, so these pin the RULES they all
// read rather than any one renderer's output.
import { describe, expect, it } from 'vitest'
import { navbarLinkGap, navbarPlacement } from './navbarLayout.js'

describe('navbarPlacement', () => {
  it('parks the links at the far edge by default', () => {
    const p = navbarPlacement({ brandAlign: 'left', linksAlign: 'right' })
    expect(p.brand.marginLeft).toBeUndefined()
    expect(p.links.marginLeft).toBe('auto')
    expect(p.links.position).toBeUndefined()
  })

  // Centring against the BAR, not against the space left over next to the
  // brand — being half a brand-width off is what makes the control feel broken.
  it('pins a centred item to the middle of the bar', () => {
    const p = navbarPlacement({ brandAlign: 'left', linksAlign: 'center' })
    expect(p.links.position).toBe('absolute')
    expect(p.links.left).toBe('50%')
    expect(p.links.transform).toBe('translateX(-50%)')
  })

  it('swaps the visual order when the brand is sent right and the links left', () => {
    const p = navbarPlacement({ brandAlign: 'right', linksAlign: 'left' })
    expect(p.links.order).toBe(0)
    expect(p.brand.order).toBe(1)
    // Only the first right-parked item takes the auto margin, or the two would
    // split the free space and drift apart.
    expect(p.brand.marginLeft).toBe('auto')
    expect(p.links.marginLeft).toBeUndefined()
  })

  it('packs both at the end when both are sent right', () => {
    const p = navbarPlacement({ brandAlign: 'right', linksAlign: 'right' })
    expect(p.brand.marginLeft).toBe('auto')
    expect(p.links.marginLeft).toBeUndefined()
  })

  it('packs both at the start when both are sent left', () => {
    const p = navbarPlacement({ brandAlign: 'left', linksAlign: 'left' })
    expect(p.brand.marginLeft).toBeUndefined()
    expect(p.links.marginLeft).toBeUndefined()
    expect(p.row.justifyContent).toBe('flex-start')
  })

  // Two absolutely-centred items would sit on top of each other.
  it('centres the row instead of stacking two centred items', () => {
    const p = navbarPlacement({ brandAlign: 'center', linksAlign: 'center' })
    expect(p.row.justifyContent).toBe('center')
    expect(p.brand.position).toBeUndefined()
    expect(p.links.position).toBeUndefined()
  })

  it('falls back to the defaults for missing or junk values', () => {
    const p = navbarPlacement({ brandAlign: 'sideways', linksAlign: undefined })
    expect(p.links.marginLeft).toBe('auto')
    expect(p.brand.order).toBe(0)
  })
})

describe('navbarLinkGap', () => {
  it('keeps 0 as a real choice and clamps the rest', () => {
    expect(navbarLinkGap({ linkGap: 0 })).toBe(0)
    expect(navbarLinkGap({ linkGap: 34 })).toBe(34)
    expect(navbarLinkGap({ linkGap: 9999 })).toBe(120)
    expect(navbarLinkGap({})).toBe(20)
    expect(navbarLinkGap({ linkGap: 'wide' })).toBe(20)
  })
})
