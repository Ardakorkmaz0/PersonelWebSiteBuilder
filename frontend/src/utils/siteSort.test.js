import { describe, expect, it } from 'vitest'
import { orderSites } from './siteSort.js'

const sites = [
  { id: 1, title: 'Alpha', slug: 'alpha', favorite: false, updated_at: '2026-01-01T00:00:00Z' },
  { id: 2, title: 'Beta', slug: 'beta', favorite: true, updated_at: '2026-01-02T00:00:00Z' },
  { id: 3, title: 'Gamma portfolio', slug: 'gamma', favorite: false, updated_at: '2026-03-01T00:00:00Z' },
  { id: 4, title: 'Delta', slug: 'delta', favorite: true, updated_at: '2026-02-01T00:00:00Z' },
]

describe('orderSites', () => {
  it('puts favorites first, then most-recently updated', () => {
    const ids = orderSites(sites).map((s) => s.id)
    // favorites (2,4) first by updated_at desc → 4 then 2; then non-favs (3,1)
    expect(ids).toEqual([4, 2, 3, 1])
  })

  it('filters by title or slug, case-insensitively', () => {
    expect(orderSites(sites, 'PORT').map((s) => s.id)).toEqual([3])
    expect(orderSites(sites, 'beta').map((s) => s.id)).toEqual([2])
  })

  it('returns a new array and does not mutate the input', () => {
    const copy = [...sites]
    orderSites(sites)
    expect(sites).toEqual(copy)
  })

  it('keeps favorite ordering even when filtered', () => {
    const ids = orderSites(sites, 'a').map((s) => s.id) // Alpha, Beta, Gamma, Delta all contain 'a'
    expect(ids[0]).toBe(4) // a favorite leads
  })
})
