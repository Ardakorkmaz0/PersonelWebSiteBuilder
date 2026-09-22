// The address of a published site — the one worth sharing.
//
// The app has always pointed at `/site/<slug>`, which is the showcase page:
// the builder's chrome, favourites, the report button, the creator's name.
// That is not the site. The site is the document served at `/s/<slug>/`, or —
// once a domain is connected and verified — at that domain. Handing someone
// the showcase page instead is like sending a gallery label instead of the
// painting.
export function siteAddress(site) {
  if (!site?.slug) return null
  if (site.custom_domain && site.domain_status === 'connected') {
    return {
      href: `https://${site.custom_domain}`,
      label: site.custom_domain,
      own: true,
    }
  }
  return {
    href: `/s/${site.slug}/`,
    label: `/s/${site.slug}/`,
    own: false,
  }
}

// The same address, absolute, for copying and for sharing outside the app.
export function siteAddressUrl(site) {
  const address = siteAddress(site)
  if (!address) return ''
  if (address.own) return address.href
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}${address.href}`
}
