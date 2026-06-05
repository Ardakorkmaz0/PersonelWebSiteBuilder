import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getPublicSite } from '../api/sites.js'
import { Renderer } from '../components/renderer/Renderer.jsx'
import { canvasHeight } from '../components/renderer/layout.js'
import { CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../components/registry.jsx'
import {
  HTML_ALLOW,
  PUBLIC_HTML_SANDBOX,
  STATIC_HTML_SANDBOX,
  withoutExecutableScripts,
} from '../utils/htmlRuntime.js'
import { schemaToSingleHtml } from '../utils/schemaToFiles.js'
import { customCssBlock, safeCustomJs, themeVariablesCss } from '../utils/theme.js'
import { googleFontHrefForTheme } from '../utils/googleFonts.js'

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
  // Absolute mode: scale the design to FILL the viewport width (no side margins) —
  // scaling up on screens wider than the design and down on narrower ones. The
  // desktop/mobile layouts switch at 768px.
  const scale = width / designW
  const left = Math.max(0, (width - designW * scale) / 2)
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
            width: designW,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <Renderer
            components={components}
            background={background}
            viewport={viewport}
            width={designW}
            flowMode={!!page.flowMode}
          />
        </div>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [site, setSite] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ok | notfound | error
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    let active = true
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
    return () => {
      active = false
    }
  }, [slug])

  // Pick the visible page from the URL hash (#<pageId>) so links/anchors work.
  useEffect(() => {
    if (!site) return
    const pages = site?.schema?.pages || []
    const pick = () => {
      const h = decodeURIComponent((window.location.hash || '').replace(/^#/, ''))
      setActiveId(pages.some((p) => p.id === h) ? h : pages[0]?.id || null)
    }
    pick()
    window.addEventListener('hashchange', pick)
    return () => window.removeEventListener('hashchange', pick)
  }, [site])

  // All hooks MUST be called on every render in the same order — keep these
  // memos above the early returns below so React doesn't see the hook count
  // change between "loading" and "ok" renders.
  const pages = site?.schema?.pages || []
  const current = pages.find((p) => p.id === activeId) || pages[0] || {}
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
  const useIframe = hasCustomJs || hasHtmlEmbed
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
        Loading...
      </div>
    )
  }

  if (status === 'notfound' || status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gray-100 text-center">
        <h1 className="text-xl font-semibold text-gray-700">
          {status === 'notfound' ? 'Site not available' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-gray-500">
          {status === 'notfound'
            ? 'This site does not exist or has not been published yet.'
            : 'Please try again later.'}
        </p>
        <Link to="/" className="mt-2 text-sm text-blue-600 hover:underline">
          Go to the builder
        </Link>
      </div>
    )
  }

  // HTML site: render the raw document in a sandboxed iframe so its JavaScript
  // runs (isolated — allow-scripts WITHOUT allow-same-origin, so it cannot touch
  // this app or the visitor's session). Native, full-viewport, responsive.
  if (site?.html) {
    const staticMode = searchParams.get('mode') === 'static'
    const iframeHtml = staticMode ? withoutExecutableScripts(site.html) : site.html
    const setHtmlPreviewMode = (nextMode) => {
      const next = new URLSearchParams(searchParams)
      if (nextMode === 'static') next.set('mode', 'static')
      else next.delete('mode')
      setSearchParams(next, { replace: true })
    }
    return (
      <>
        <iframe
          title={site.title || 'site'}
          srcDoc={iframeHtml}
          sandbox={staticMode ? STATIC_HTML_SANDBOX : PUBLIC_HTML_SANDBOX}
          allow={HTML_ALLOW}
          allowFullScreen
          style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }}
        />
        <div className="fixed right-4 top-4 z-[100] flex overflow-hidden rounded-[2px] border border-[#8a8886] bg-white text-xs font-semibold shadow-lg">
          <button
            type="button"
            onClick={() => setHtmlPreviewMode('static')}
            className={`px-3 py-2 ${
              staticMode ? 'bg-[#2b579a] text-white' : 'text-[#323130] hover:bg-[#f3f2f1]'
            }`}
          >
            Static preview
          </button>
          <button
            type="button"
            onClick={() => setHtmlPreviewMode('live')}
            className={`px-3 py-2 ${
              !staticMode ? 'bg-[#2b579a] text-white' : 'text-[#323130] hover:bg-[#f3f2f1]'
            }`}
          >
            Run JavaScript
          </button>
        </div>
        {site.published === false && (
          <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-[2px] border border-[#8a8886] bg-[#fff4ce] px-4 py-2 text-xs font-medium text-[#5d4a06] shadow-lg">
            Draft preview — this site is not published yet, only you can see it.
          </div>
        )}
      </>
    )
  }

  const siteCss = `${themeVariablesCss(site?.schema?.theme)}
body { font-family: var(--site-font, system-ui, 'Segoe UI', Roboto, sans-serif); color: var(--site-text, #1d1d1f); background: var(--site-bg, #ffffff); }
${customCssBlock(site?.schema?.customCss)}`

  const go = (id) => {
    setActiveId(id)
    window.history.pushState(null, '', `#${encodeURIComponent(id)}`)
  }

  if (useIframe) {
    const setComponentPreviewMode = (nextMode) => {
      const next = new URLSearchParams(searchParams)
      if (nextMode === 'static') next.set('mode', 'static')
      else next.delete('mode')
      setSearchParams(next, { replace: true })
    }
    return (
      <>
        {pages.length > 1 && (
          <nav className="fixed inset-x-0 top-0 z-[110] flex flex-wrap justify-center gap-1 border-b border-black/5 bg-white/80 px-3 py-2 backdrop-blur">
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => go(p.id)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  p.id === current.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.name}
              </button>
            ))}
          </nav>
        )}
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
            inset: pages.length > 1 ? '44px 0 0 0' : 0,
            width: '100%',
            height: pages.length > 1 ? 'calc(100% - 44px)' : '100%',
            border: 'none',
          }}
        />
        <div className="fixed right-4 top-4 z-[120] flex overflow-hidden rounded-[2px] border border-[#8a8886] bg-white text-xs font-semibold shadow-lg">
          <button
            type="button"
            onClick={() => setComponentPreviewMode('static')}
            className={`px-3 py-2 ${
              staticMode ? 'bg-[#2b579a] text-white' : 'text-[#323130] hover:bg-[#f3f2f1]'
            }`}
          >
            Static preview
          </button>
          <button
            type="button"
            onClick={() => setComponentPreviewMode('live')}
            className={`px-3 py-2 ${
              !staticMode ? 'bg-[#2b579a] text-white' : 'text-[#323130] hover:bg-[#f3f2f1]'
            }`}
          >
            Run JavaScript
          </button>
        </div>
        {site.published === false && (
          <div className="fixed bottom-4 left-1/2 z-[120] -translate-x-1/2 rounded-[2px] border border-[#8a8886] bg-[#fff4ce] px-4 py-2 text-xs font-medium text-[#5d4a06] shadow-lg">
            Draft preview — this site is not published yet, only you can see it.
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
    <div>
      {fontHref && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link key={fontHref} rel="stylesheet" href={fontHref} />
        </>
      )}
      <style>{siteCss}</style>
      {pages.length > 1 && (
        <nav className="sticky top-0 z-50 flex flex-wrap justify-center gap-1 border-b border-black/5 bg-white/80 px-3 py-2 backdrop-blur">
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => go(p.id)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                p.id === current.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.name}
            </button>
          ))}
        </nav>
      )}
      <ResponsiveSite key={current.id} page={current} />

      {site && site.published === false && (
        <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-[2px] border border-[#8a8886] bg-[#fff4ce] px-4 py-2 text-xs font-medium text-[#5d4a06] shadow-lg">
          Draft preview — this site is not published yet, only you can see it.
        </div>
      )}
    </div>
  )
}
