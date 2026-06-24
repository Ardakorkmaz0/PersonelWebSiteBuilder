import { describe, expect, it } from 'vitest'
import { orderSites } from './siteSort.js'

const sites = [
  { id: 1, title: 'Alpha', slug: 'alpha', updated_at: '2026-01-01T00:00:00Z' },
  { id: 2, title: 'Beta', slug: 'beta', updated_at: '2026-03-02T00:00:00Z' },
  { id: 3, title: 'Gamma portfolio', slug: 'gamma', updated_at: '2026-02-01T00:00:00Z' },
]

describe('orderSites', () => {
  it('orders by most-recently updated', () => {
    expect(orderSites(sites).map((s) => s.id)).toEqual([2, 3, 1])
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
})
