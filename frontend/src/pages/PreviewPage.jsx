import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getPublicSite, countSiteView, submitSiteForm } from '../api/sites.js'
import { Renderer } from '../components/renderer/Renderer.jsx'
import { canvasHeight } from '../components/renderer/layout.js'
import { CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../components/registry.jsx'
import {
  HTML_ALLOW,
  PUBLIC_HTML_SANDBOX,
  STATIC_HTML_SANDBOX,
  withBuilderInteractiveHtml,
  withViewportMeta,
  withoutExecutableScripts,
} from '../utils/htmlRuntime.js'
import { schemaToSingleHtml } from '../utils/schemaToFiles.js'
import { pageHasMotion } from '../utils/motion.js'
import { customCssBlock, safeCustomJs, themeVariablesCss } from '../utils/theme.js'
import { googleFontHrefForTheme } from '../utils/googleFonts.js'
import PublicToolbar from '../components/preview/PublicToolbar.jsx'
import { useLanguage } from '../i18n/useLanguage.js'

const MOBILE_BREAKPOINT = 768

// Genuinely responsive: narrow screens (< 768px) render the dedicated mobile
// design (390px), wider screens render the desktop design (1000px). Each is
// centered and scaled to fit its band — the two are independent layouts, not
// one design shrunk down.
function ResponsiveSite({ page }) {
  const components = page.components || []
  const ref = useRef(null)
  const [width, setWidth] = useState(CANVAS_WIDTH)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const isMobileView = width < MOBILE_BREAKPOINT
  const viewport = isMobileView ? 'mobile' : 'pc'
  const background = isMobileView
    ? page.backgroundMobile || page.background || '#ffffff'
    : page.background || '#ffffff'

  // FLOW (fluid) mode: render at the visitor's ACTUAL width with no scaling, so
  // the flex/wrap layout reflows natively at every screen size — like a normal
  // responsive website (no magnified design, no side margins).
  if (page.flowMode) {
    return (
      <div ref={ref} style={{ width: '100%', minHeight: '100vh', background }}>
        <Renderer
          components={components}
          background={background}
          viewport={viewport}
          width={width}
          flowMode
        />
      </div>
    )
  }

  const designW = isMobileView
    ? page.mobileWidth || MOBILE_CANVAS_WIDTH
    : page.canvasWidth || CANVAS_WIDTH
  // Absolute mode keeps the selected design grid at 1x, but lets full-width
  // sections use all available browser space. Regular elements remain centered
  // on the original grid; only genuinely narrow screens scale the active design.
  const renderW = Math.max(designW, width)
  const scale = Math.min(1, width / designW)
  const left = Math.max(0, (width - renderW * scale) / 2)
  const height = canvasHeight(components, viewport) * scale

  return (
    <div
      ref={ref}
      style={{ width: '100%', minHeight: '100vh', overflow: 'hidden', background }}
    >
      <div style={{ position: 'relative', height }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left,
            width: renderW,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <Renderer
            components={components}
            background={background}
            viewport={viewport}
            width={renderW}
            designWidth={designW}
            flowMode={!!page.flowMode}
          />
        </div>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  const { t } = useLanguage()
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [site, setSite] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ok | notfound | error
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    let active = true
    const load = () => {
      getPublicSite(slug)
        .then((data) => {
          if (!active) return
          setSite(data)
          setStatus('ok')
          if (data?.title) document.title = data.title
        })
        .catch((e) => {
          if (!active) return
          setStatus(e.response?.status === 404 ? 'notfound' : 'error')
        })
    }
    load()
    // A preview tab usually stays open next to the editor. Refetch when the
    // user switches back to it, so a fresh Save shows up without a manual
    // reload — otherwise "Apply & Save did nothing" is the natural (wrong)
    // conclusion. Identical content produces an identical srcDoc string, so
    // an unchanged site never reloads the iframe.
    const onBack = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
    }
  }, [slug])

  // Apply launch metadata to the public page, so the readiness settings also
  // drive search results, social previews, and the browser tab.
  useEffect(() => {
    if (!site) return undefined
    const seo = site.site_options?.seo || {}
    const previousTitle = document.title
    document.title = seo.title?.trim() || site.title || previousTitle
    const touched = []
    const setMeta = (attribute, key, content) => {
      if (!String(content || '').trim()) return
      let node = document.head.querySelector(`meta[${attribute}="${key}"]`)
      const created = !node
      if (!node) {
        node = document.createElement('meta')
        node.setAttribute(attribute, key)
        document.head.appendChild(node)
      }
      touched.push({ node, created, previous: node.getAttribute('content') })
      node.setAttribute('content', String(content).trim())
    }
    setMeta('name', 'description', seo.description)
    setMeta('property', 'og:title', seo.title || site.title)
    setMeta('property', 'og:description', seo.description)
    setMeta('property', 'og:image', seo.socialImage)

    if (String(seo.favicon || '').trim()) {
      let favicon = document.head.querySelector('link[rel~="icon"]')
      const created = !favicon
      if (!favicon) {
        favicon = document.createElement('link')
        favicon.setAttribute('rel', 'icon')
        document.head.appendChild(favicon)
      }
      touched.push({ favicon, created, previous: favicon.getAttribute('href') })
      favicon.setAttribute('href', seo.favicon.trim())
    }

    return () => {
      document.title = previousTitle
      touched.forEach(({ node, favicon, created, previous }) => {
        const element = node || favicon
        if (created) element.remove()
        else if (node) {
          if (previous == null) node.removeAttribute('content')
          else node.setAttribute('content', previous)
        } else if (previous == null) favicon.removeAttribute('href')
        else favicon.setAttribute('href', previous)
      })
    }
  }, [site])

  // Count exactly ONE view per slug per browser tab session. The sessionStorage
  // guard makes this idempotent against React StrictMode's double-effect, the
  // focus/visibility refetches above, and plain refreshes — so a single visit
  // is a single view (the backend also skips the owner's own views).
  useEffect(() => {
    if (!slug) return
    const key = `pwb-viewed:${slug}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    countSiteView(slug).catch(() => sessionStorage.removeItem(key))
  }, [slug])

  useEffect(() => {
    const send = async (data, page, source) => {
      try {
        await submitSiteForm(slug, data, page)
        source?.postMessage?.({ type: 'pwb-form-result', ok: true }, '*')
        return true
      } catch {
        source?.postMessage?.({ type: 'pwb-form-result', ok: false }, '*')
        return false
      }
    }
    const onMessage = (event) => {
      if (event.data?.type === 'pwb-form-submit') {
        send(event.data.data || {}, event.data.page || activeId || '', event.source)
      }
    }
    const onSubmit = (event) => {
      const form = event.target
      if (!form?.matches?.('form') || !form.closest('[data-public-site-canvas]')) return
      const action = String(form.getAttribute('action') || '').trim()
      if (/^https?:\/\//i.test(action) || /^mailto:|^tel:/i.test(action)) return
      event.preventDefault()
      const data = {}
      form.querySelectorAll('input,textarea,select').forEach((field) => {
        const type = String(field.type || '').toLowerCase()
        const name = String(field.name || field.id || '').trim()
        if (!name || type === 'password' || type === 'file' || type === 'hidden') return
        if ((type === 'checkbox' || type === 'radio') && !field.checked) return
        data[name.slice(0, 80)] = String(field.value || '').slice(0, 2000)
      })
      send(data, activeId || '').then((ok) => {
        let result = form.querySelector('[data-pwb-form-status]')
        if (!result) {
          result = document.createElement('div')
          result.dataset.pwbFormStatus = ''
          result.setAttribute('role', 'status')
          form.appendChild(result)
        }
        result.textContent = t(ok ? 'Message sent.' : 'Message could not be sent.')
      })
    }
    window.addEventListener('message', onMessage)
    document.addEventListener('submit', onSubmit, true)
    return () => {
      window.removeEventListener('message', onMessage)
      document.removeEventListener('submit', onSubmit, true)
    }
  }, [activeId, slug, t])

  // Pick the visible page from the URL hash (#<pageId>) so links/anchors work.
  // Only switch when the hash names a real page — in-page anchors like #top or
  // #contact are scroll targets and must NOT bounce the visitor to the home
  // page. The first pick (no/unknown hash) defaults to the first page.
  useEffect(() => {
    if (!site) return
    const pages = site?.schema?.pages || []
    let settled = false
    const pick = () => {
      const h = decodeURIComponent((window.location.hash || '').replace(/^#/, ''))
      if (pages.some((p) => p.id === h)) {
        setActiveId(h)
        settled = true
      } else if (!settled) {
        setActiveId(pages[0]?.id || null)
        settled = true
      }
      // else: unknown hash (#top / #section) → leave the page as-is, let the
      // browser scroll to the matching element.
    }
    pick()
    window.addEventListener('hashchange', pick)
    return () => window.removeEventListener('hashchange', pick)
  }, [site])

  // "Top of page" links (#top / #) scroll to the top in component sites —
  // there's no element with that id, so the browser wouldn't otherwise act.
  // #pageId is handled by the hashchange listener; #section scrolls natively.
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest?.('a[href^="#"]')
      if (!a) return
      const href = a.getAttribute('href')
      if (href === '#' || href === '#top') {
        e.preventDefault()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Cross-page links FROM inside a sandboxed page iframe (HTML pages, and
  // component pages that run JS) can't reach the parent directly, so their
  // runtime posts a 'pwb-navigate' message when a #hash matches no element in
  // their own document. If the hash names a real page, switch to it.
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type !== 'pwb-navigate') return
      const id = decodeURIComponent(String(e.data.hash || '').replace(/^#/, ''))
      const list = site?.schema?.pages || []
      if (id && list.some((p) => p.id === id)) {
        setActiveId(id)
        window.history.pushState(null, '', `#${encodeURIComponent(id)}`)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [site])

  // All hooks MUST be called on every render in the same order — keep these
  // memos above the early returns below so React doesn't see the hook count
  // change between "loading" and "ok" renders.
  const sitePages = site?.schema?.pages
  const pages = useMemo(() => sitePages || [], [sitePages])
  const current = useMemo(
    () => pages.find((p) => p.id === activeId) || pages[0] || {},
    [pages, activeId],
  )
  const hasCustomJs = !!safeCustomJs(site?.schema?.customJs)
  const hasHtmlEmbed = useMemo(() => {
    const walk = (arr) => {
      for (const c of arr || []) {
        if (c?.type === 'html') return true
        if (Array.isArray(c?.children) && walk(c.children)) return true
      }
      return false
    }
    return (site?.schema?.pages || []).some((p) => walk(p?.components))
  }, [site?.schema?.pages])
  const hasPinnedFixed = useMemo(() => {
    // Sticky counts too: on absolute pages it needs the export runtime's
    // stick handler (iframe path) — the plain Renderer would drop it at the
    // page top and never engage it inside the scaled wrapper.
    const walk = (arr) => {
      for (const c of arr || []) {
        if (['fixed', 'sticky'].includes(c?.props?.scrollBehavior)) return true
        if (Array.isArray(c?.children) && walk(c.children)) return true
      }
      return false
    }
    return (site?.schema?.pages || []).some((p) => walk(p?.components))
  }, [site?.schema?.pages])
  // Reveal/hover motion lives in the export's stylesheet + observer, so a page
  // that uses it must publish through the iframe, not the plain React renderer.
  const hasMotion = useMemo(
    () => (site?.schema?.pages || []).some((p) => pageHasMotion(p)),
    [site?.schema?.pages],
  )
  const useIframe = hasCustomJs || hasHtmlEmbed || hasPinnedFixed || hasMotion
  const staticMode = searchParams.get('mode') === 'static'
  const iframeHtml = useMemo(() => {
    if (!useIframe || !current?.id) return ''
    const pageSchema = {
      theme: site?.schema?.theme,
      customCss: site?.schema?.customCss,
      customJs: staticMode ? '' : site?.schema?.customJs,
      pages: [current],
    }
    return schemaToSingleHtml(pageSchema, site?.title || current.name || 'My Site')
  }, [
    useIframe,
    staticMode,
    current,
    site?.schema?.theme,
    site?.schema?.customCss,
    site?.schema?.customJs,
    site?.title,
  ])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        {t('Loading...')}
      </div>
    )
  }

  if (status === 'notfound' || status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gray-100 text-center">
        <h1 className="text-xl font-semibold text-gray-700">
          {status === 'notfound' ? t('Site not available') : t('Something went wrong')}
        </h1>
        <p className="text-sm text-gray-500">
          {status === 'notfound'
            ? t('This site does not exist or has not been published yet.')
            : t('Please try again later.')}
        </p>
        <Link to="/" className="mt-2 text-sm text-blue-600 hover:underline">
          {t('Go to the builder')}
        </Link>
      </div>
    )
  }

  const go = (pageId) => {
    setActiveId(pageId)
    window.history.pushState(null, '', `#${encodeURIComponent(pageId)}`)
  }

  // HTML site: render the raw document(s) in a sandboxed iframe so the
  // JavaScript runs (isolated — allow-scripts WITHOUT allow-same-origin, so it
  // cannot touch this app or the visitor's session). Multi-page sites carry
  // one document per schema page; a top nav switches between them. Legacy
  // single-document sites only have site.html.
  // Resolve the HTML for a page: its own per-page document, or — for a legacy
  // single-document site — site.html mapped onto the home page.
  const htmlFor = (p) => {
    if ((p?.html || '').trim()) return p.html
    if (p && pages[0]?.id === p.id && (site?.html || '').trim()) return site.html
    return ''
  }
  const currentHtml = htmlFor(current)
  // The ACTIVE page decides how THIS view renders, so a mixed site can have
  // HTML pages and component pages side by side — all reachable from one nav.
  const currentIsHtml = current?.mode === 'html' || !!currentHtml.trim()
  if (currentIsHtml) {
    const staticMode = searchParams.get('mode') === 'static'
    // Inject a viewport meta when the document lacks one so phones render
    // the responsive layout instead of a zoomed-out desktop page. Live mode
    // also gets the interactive shim (tabs + '#' anchor interception) — the
    // same behaviours the editor's View mode injects, minus the editor-only
    // readonly guard. Without it, in-page anchor links would navigate the
    // about:srcdoc iframe and blank the site out.
    const iframeHtml = withViewportMeta(
      staticMode
        ? withoutExecutableScripts(currentHtml)
        : withBuilderInteractiveHtml(currentHtml),
    )
    const setHtmlPreviewMode = (nextMode) => {
      const next = new URLSearchParams(searchParams)
      if (nextMode === 'static') next.set('mode', 'static')
      else next.delete('mode')
      setSearchParams(next, { replace: true })
    }
    return (
      <>
        <PublicToolbar site={site} pages={pages} activePageId={current.id} onNavigate={go} />
        <iframe
          key={current.id}
          title={site.title || 'site'}
          srcDoc={iframeHtml}
          sandbox={staticMode ? STATIC_HTML_SANDBOX : PUBLIC_HTML_SANDBOX}
          allow={HTML_ALLOW}
          allowFullScreen
          style={{
            position: 'fixed',
            top: '64px',
            right: 0,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 'calc(100% - 64px)',
            border: 'none',
            boxSizing: 'border-box',
          }}
        />
        {/* Bottom-right, clear of the (possibly multi-row) top page nav, so
            the Static/Run-JS toggle is always visible and clickable. */}
        <div
          className="fixed bottom-4 right-4 z-[120] flex overflow-hidden rounded-lg border border-[#d1d5db] bg-white text-xs font-semibold shadow-lg"
        >
          <button
            type="button"
            onClick={() => setHtmlPreviewMode('static')}
            className={`px-3 py-2 ${
              staticMode ? 'bg-[#4f46e5] text-white' : 'text-[#374151] hover:bg-[#f3f4f6]'
            }`}
          >
            {t('Static preview')}
          </button>
          <button
            type="button"
            onClick={() => setHtmlPreviewMode('live')}
            className={`px-3 py-2 ${
              !staticMode ? 'bg-[#4f46e5] text-white' : 'text-[#374151] hover:bg-[#f3f4f6]'
            }`}
          >
            {t('Run JavaScript')}
          </button>
        </div>
        {site.published === false && (
          <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-[#d1d5db] bg-[#fff4ce] px-4 py-2 text-xs font-medium text-[#5d4a06] shadow-lg">
            {t('Draft preview — this site is not published yet, only you can see it.')}
          </div>
        )}
      </>
    )
  }

  const siteCss = `${themeVariablesCss(site?.schema?.theme)}
body { font-family: var(--site-font, system-ui, 'Segoe UI', Roboto, sans-serif); color: var(--site-text, #1d1d1f); background: var(--site-bg, #ffffff); }
${customCssBlock(site?.schema?.customCss)}`

  if (useIframe) {
    const setComponentPreviewMode = (nextMode) => {
      const next = new URLSearchParams(searchParams)
      if (nextMode === 'static') next.set('mode', 'static')
      else next.delete('mode')
      setSearchParams(next, { replace: true })
    }
    return (
      <>
        <PublicToolbar site={site} pages={pages} activePageId={current.id} onNavigate={go} />
        <iframe
          key={`${current.id}-${staticMode ? 'static' : 'live'}`}
          title={site.title || current.name || 'site'}
          srcDoc={iframeHtml}
          // Component sites keep allow-scripts on in BOTH modes so the internal
          // runtime (responsive scale for non-flow pages, tabs handler, anchor
          // smooth-scroll) always works. Static mode just strips the user's
          // customJs from the emitted HTML (handled in the useMemo above), so
          // layout/clicks stay sane and only user effects disappear.
          sandbox={PUBLIC_HTML_SANDBOX}
          allow={HTML_ALLOW}
          allowFullScreen
          style={{
            position: 'fixed',
            top: '64px',
            right: 0,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 'calc(100% - 64px)',
            border: 'none',
          }}
        />
        <div className="fixed bottom-4 right-4 z-[120] flex overflow-hidden rounded-lg border border-[#d1d5db] bg-white text-xs font-semibold shadow-lg">
          <button
            type="button"
            onClick={() => setComponentPreviewMode('static')}
            className={`px-3 py-2 ${
              staticMode ? 'bg-[#4f46e5] text-white' : 'text-[#374151] hover:bg-[#f3f4f6]'
            }`}
          >
            {t('Static preview')}
          </button>
          <button
            type="button"
            onClick={() => setComponentPreviewMode('live')}
            className={`px-3 py-2 ${
              !staticMode ? 'bg-[#4f46e5] text-white' : 'text-[#374151] hover:bg-[#f3f4f6]'
            }`}
          >
            {t('Run JavaScript')}
          </button>
        </div>
        {site.published === false && (
          <div className="fixed bottom-4 left-1/2 z-[120] -translate-x-1/2 rounded-lg border border-[#d1d5db] bg-[#fff4ce] px-4 py-2 text-xs font-medium text-[#5d4a06] shadow-lg">
            {t('Draft preview — this site is not published yet, only you can see it.')}
          </div>
        )}
      </>
    )
  }

  // Auto-attach Google Fonts when the theme references a curated family —
  // React's `<link>` tag still goes through the document head even in the
  // body since React 19 hoists it. `key` forces a remount when the font
  // changes so stale URLs don't linger.
  const fontHref = googleFontHrefForTheme(site?.schema?.theme)
  return (
    <div className="min-h-screen pt-16">
      <PublicToolbar site={site} pages={pages} activePageId={current.id} onNavigate={go} />
      {fontHref && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link key={fontHref} rel="stylesheet" href={fontHref} />
        </>
      )}
      <style>{siteCss}</style>
      <div data-public-site-canvas>
        <ResponsiveSite key={current.id} page={current} />
      </div>

      {site && site.published === false && (
        <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-[#d1d5db] bg-[#fff4ce] px-4 py-2 text-xs font-medium text-[#5d4a06] shadow-lg">
          {t('Draft preview — this site is not published yet, only you can see it.')}
        </div>
      )}
    </div>
  )
}
