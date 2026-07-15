function htmlDocument(html) {
  if (!html?.trim() || typeof DOMParser === 'undefined') return null
  try { return new DOMParser().parseFromString(html, 'text/html') } catch { return null }
}

function walkComponents(components, visit) {
  for (const component of components || []) {
    visit(component)
    walkComponents(component.children, visit)
  }
}

export function analyzeSiteReadiness({ title, pages = [], pageHtmlMap = {}, siteOptions = {} }) {
  let missingAlt = 0
  let weakLinks = 0
  let emptyPages = 0
  let mobileGaps = 0

  for (const page of pages) {
    const html = pageHtmlMap[page.id] ?? page.html ?? ''
    const doc = htmlDocument(html)
    if (page.mode === 'html' || html.trim()) {
      const text = doc?.body?.textContent?.trim() || ''
      if (!text && !doc?.querySelector('img,video,iframe')) emptyPages += 1
      doc?.querySelectorAll('img').forEach((img) => {
        if (!img.getAttribute('alt')?.trim()) missingAlt += 1
      })
      doc?.querySelectorAll('a,button').forEach((node) => {
        if (node.tagName === 'A' && !node.getAttribute('href')?.trim()) weakLinks += 1
        if (!node.textContent?.trim() && !node.getAttribute('aria-label')) weakLinks += 1
      })
      if (!doc?.querySelector('meta[name="viewport"]')) mobileGaps += 1
      continue
    }
    const components = page.components || []
    if (!components.length) emptyPages += 1
    walkComponents(components, (component) => {
      if (component.type === 'image' && !component.props?.alt?.trim()) missingAlt += 1
      if (['button', 'link'].includes(component.type) && !component.props?.href?.trim()) weakLinks += 1
      if (!page.flowMode && !component.mobileLayout) mobileGaps += 1
    })
  }

  const seo = siteOptions.seo || {}
  const checks = [
    { id: 'title', ok: title?.trim().length >= 3, label: 'Clear site title', action: 'Add a descriptive site title.' },
    { id: 'pages', ok: pages.length > 0 && emptyPages === 0, label: 'Pages have content', action: '{count} empty page(s) need content.', params: { count: emptyPages } },
    { id: 'mobile', ok: mobileGaps === 0, label: 'Mobile-ready layout', action: '{count} mobile issue(s) detected.', params: { count: mobileGaps } },
    { id: 'alt', ok: missingAlt === 0, label: 'Image alternative text', action: '{count} image(s) are missing alternative text.', params: { count: missingAlt } },
    { id: 'links', ok: weakLinks === 0, label: 'Buttons and links', action: '{count} link or button issue(s) detected.', params: { count: weakLinks } },
    { id: 'seo_title', ok: seo.title?.trim().length >= 10 && seo.title.trim().length <= 60, label: 'SEO title', action: 'Use an SEO title between 10 and 60 characters.' },
    { id: 'seo_description', ok: seo.description?.trim().length >= 50 && seo.description.trim().length <= 160, label: 'SEO description', action: 'Use an SEO description between 50 and 160 characters.' },
    { id: 'social', ok: !!seo.socialImage?.trim(), label: 'Social sharing image', action: 'Add an image for social sharing.' },
    { id: 'favicon', ok: !!seo.favicon?.trim(), label: 'Favicon', action: 'Add a favicon.' },
  ]
  const passed = checks.filter((item) => item.ok).length
  return { score: Math.round((passed / checks.length) * 100), checks, missingAlt, weakLinks, emptyPages, mobileGaps }
}
