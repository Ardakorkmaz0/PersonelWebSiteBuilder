// The link worth giving somebody.
//
// The app pointed at `/site/<slug>` everywhere, which is the showcase page —
// our chrome, the favourite button, the creator's name. The site itself is the
// document at `/s/<slug>/`, or the owner's own domain once it is connected.
import { describe, expect, it } from 'vitest'
import { siteAddress, siteAddressUrl } from './siteAddress.js'

describe('the address of a published site', () => {
  it('is the served page when there is no domain', () => {
    expect(siteAddress({ slug: 'ada' })).toEqual({
      href: '/s/ada/', label: '/s/ada/', own: false,
    })
  })

  it('is the owner\'s own domain once it is connected', () => {
    const site = { slug: 'ada', custom_domain: 'ada.example', domain_status: 'connected' }

    expect(siteAddress(site)).toEqual({
      href: 'https://ada.example', label: 'ada.example', own: true,
    })
  })

  // A domain that is saved but not verified serves nothing yet; offering it
  // would be handing out a link that does not work.
  it('ignores a domain that is not connected yet', () => {
    const site = { slug: 'ada', custom_domain: 'ada.example', domain_status: 'pending' }
    expect(siteAddress(site).label).toBe('/s/ada/')
  })

  it('has nothing to say about a site with no slug', () => {
    expect(siteAddress(null)).toBe(null)
    expect(siteAddressUrl(undefined)).toBe('')
  })

  it('gives an absolute url for copying', () => {
    expect(siteAddressUrl({ slug: 'ada' })).toBe(`${window.location.origin}/s/ada/`)
    expect(siteAddressUrl({ slug: 'ada', custom_domain: 'ada.example', domain_status: 'connected' }))
      .toBe('https://ada.example')
  })
})
