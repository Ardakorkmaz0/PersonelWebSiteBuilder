import { describe, expect, it } from 'vitest'
import { componentTextHint, isDeadSectionLink, linkSectionsFor } from './linkTargets.js'

const c = (id, y, props = {}, extra = {}) => ({ id, type: 'text', props, layout: { x: 0, y, w: 100, h: 40 }, ...extra })

describe('linkSectionsFor', () => {
  it('lists the page in reading order, nested blocks after their parent, without the one being edited', () => {
    const sections = linkSectionsFor([
      c('footer', 900, { text: 'Footer' }),
      c('nav', 0, {}, { type: 'navbar' }),
      c('about', 300, { heading: 'About us' }, { type: 'region', children: [c('inner', 20, { text: 'Inside' })] }),
    ], { excludeId: 'nav' })
    expect(sections.map((s) => s.id)).toEqual(['about', 'inner', 'footer'])
    expect(sections.find((s) => s.id === 'inner').depth).toBe(1)
    expect(sections[0].text).toBe('About us')
  })

  it('copes with nothing', () => {
    expect(linkSectionsFor(undefined)).toEqual([])
  })
})

describe('componentTextHint', () => {
  it('uses the first line of the most telling text, shortened', () => {
    expect(componentTextHint({ props: { text: 'Line one\nLine two' } })).toBe('Line one')
    expect(componentTextHint({ props: { title: 'x'.repeat(60) } })).toHaveLength(40)
    expect(componentTextHint({})).toBe('')
  })
})

describe('isDeadSectionLink', () => {
  const sections = [{ id: 'region_ab12cd' }]
  it('flags an anchor that matches nothing on the page — the default navbar #about', () => {
    expect(isDeadSectionLink('#about', sections)).toBe(true)
    expect(isDeadSectionLink('#region_ab12cd', sections)).toBe(false)
  })
  it('leaves top-of-page, external and empty links alone', () => {
    for (const href of ['#', '#top', 'https://x.test', '', undefined]) expect(isDeadSectionLink(href, sections)).toBe(false)
  })
})

describe('bands are named by what is in them', () => {
  it('a section with no text of its own takes its first inner heading', () => {
    const band = (id, y, text) => ({
      id, type: 'region', props: {}, layout: { x: 0, y, w: 1000, h: 300 },
      children: [{ id: `${id}_h`, type: 'heading', props: { text }, layout: { x: 0, y: 10, w: 200, h: 40 } }],
    })
    const [features, , pricing] = linkSectionsFor([band('a', 0, 'Features'), band('b', 400, 'Pricing plans')])
    expect(features.text).toBe('Features')
    expect(pricing.text).toBe('Pricing plans')
  })
})
