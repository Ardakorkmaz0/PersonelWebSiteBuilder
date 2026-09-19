import { useEffect, useRef, useState } from 'react'
import { getSite, getPublicSite } from '../../api/sites.js'
import { schemaToResponsiveHtml } from '../../utils/responsiveHtml.js'
import { withoutExecutableScripts } from '../../utils/htmlRuntime.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import './sitePreview.css'

// A live, scaled-down thumbnail of a site's home page (the "Minecraft map"
// under the title). Lazy: only fetches + renders once the card scrolls near
// view (IntersectionObserver). Inert: scripts are stripped AND the iframe is
// sandboxed without allow-scripts, so a thumbnail can never run code or be
// clicked into. The built document is cached per site id so re-mounts don't
// refetch.
//
// Two opt-in modes for the Explore cards:
//   fill          — take the parent's height (the card sets an aspect ratio)
//                   instead of a fixed pixel height.
//   scrollOnHover — while `scrolling` is true the page glides from top to
//                   bottom inside its own frame, so a visitor sees the whole
//                   site without opening it; it glides back when released.
//                   The page is scrolled INSIDE a viewport of fixed height —
//                   growing the iframe instead would stretch every 100vh hero
//                   along with it. Reading and scrolling the inner document
//                   needs allow-same-origin; allow-scripts is still withheld
//                   (and the scripts are stripped), so nothing in it can run.

const LOGICAL_W = 1200
const cache = new Map() // site.id -> html doc string

// Scrolling pace, in page pixels per millisecond (≈ 3000px in 6s), with the
// trip clamped so a short page does not twitch and a long one does not crawl.
const SCROLL_SPEED = 0.5
const SCROLL_MIN_MS = 1200
const SCROLL_MAX_MS = 9000
const RETURN_MS = 450

// The frame's own scrollbar would sit in the thumbnail, and a site's
// `scroll-behavior: smooth` would fight the frame-by-frame scroll below.
const SCROLL_PREVIEW_CSS =
  '<style data-pwb-preview>html{scrollbar-width:none!important;scroll-behavior:auto!important}'
  + 'html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important}</style>'

function buildDoc(site) {
  const raw = site.html && site.html.trim()
    ? site.html
    : schemaToResponsiveHtml(site.schema, site.title)
  return withoutExecutableScripts(raw)
}

function withScrollPreviewCss(doc) {
  if (/<\/head>/i.test(doc)) return doc.replace(/<\/head>/i, `${SCROLL_PREVIEW_CSS}</head>`)
  return SCROLL_PREVIEW_CSS + doc
}

function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    return false
  }
}

const easeInOut = (progress) => 0.5 - Math.cos(Math.PI * progress) / 2
const easeOut = (progress) => 1 - (1 - progress) ** 3

export default function SitePreview({
  site,
  height = 150,
  source = 'owner',
  fill = false,
  scrollOnHover = false,
  scrolling = false,
}) {
  const { t } = useLanguage()
  const boxRef = useRef(null)
  const frameRef = useRef(null)
  const [doc, setDoc] = useState(() => cache.get(site.id) || null)
  const [visible, setVisible] = useState(false)
  const [size, setSize] = useState({ w: 360, h: height })
  const [failed, setFailed] = useState(false)
  const [frameReady, setFrameReady] = useState(false)

  // Reveal when scrolled near the viewport.
  useEffect(() => {
    const el = boxRef.current
    if (!el || visible) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  // Track the box so the page can be scaled to fit it.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const update = () => setSize((prev) => {
      const next = { w: el.clientWidth || 360, h: el.clientHeight || height }
      return prev.w === next.w && prev.h === next.h ? prev : next
    })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [height])

  // Fetch + build the document once revealed (the mount initializer already
  // served any cached doc, so a hit never reaches here).
  useEffect(() => {
    if (!visible || doc) return undefined
    let alive = true
    const fetcher = source === 'public' ? getPublicSite(site.slug) : getSite(site.id)
    fetcher
      .then((full) => {
        const d = buildDoc(full)
        cache.set(site.id, d)
        if (alive) setDoc(d)
      })
      .catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [visible, doc, site.id, site.slug, source])

  // Glide through the page while `scrolling`, back to the top when it ends.
  // Each change cancels the trip in progress and starts from where it got to.
  useEffect(() => {
    if (!scrollOnHover || !frameReady) return undefined
    let win
    let root
    try {
      win = frameRef.current?.contentWindow
      root = frameRef.current?.contentDocument?.documentElement
    } catch {
      return undefined
    }
    if (!win || !root) return undefined
    const max = Math.max(0, root.scrollHeight - win.innerHeight)
    const target = scrolling && !prefersReducedMotion() ? max : 0
    const from = win.scrollY || 0
    const distance = target - from
    if (!distance) return undefined
    const duration = scrolling
      ? Math.min(SCROLL_MAX_MS, Math.max(SCROLL_MIN_MS, Math.abs(distance) / SCROLL_SPEED))
      : RETURN_MS
    const ease = scrolling ? easeInOut : easeOut
    let frame = 0
    const started = performance.now()
    const step = (now) => {
      const progress = Math.min(1, (now - started) / duration)
      win.scrollTo(0, Math.round(from + distance * ease(progress)))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [scrollOnHover, scrolling, frameReady])

  const boxH = fill ? size.h : height
  const scale = size.w / LOGICAL_W
  const viewportH = Math.max(1, Math.round(boxH / (scale || 1)))

  return (
    <div
      ref={boxRef}
      data-site-preview=""
      className={`relative w-full overflow-hidden ${fill ? 'h-full' : 'rounded-xl border border-[var(--studio-border)]'} bg-[var(--studio-control)]`}
      style={fill ? undefined : { height }}
    >
      {doc ? (
        <iframe
          ref={frameRef}
          title={`preview-${site.id}`}
          srcDoc={scrollOnHover ? withScrollPreviewCss(doc) : doc}
          sandbox={scrollOnHover ? 'allow-same-origin' : ''}
          tabIndex={-1}
          aria-hidden
          onLoad={() => setFrameReady(true)}
          style={{
            width: LOGICAL_W,
            height: viewportH,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            background: '#ffffff',
          }}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-[var(--studio-text-faint)]">
          {failed ? (
            <span>{t('No preview')}</span>
          ) : (
            <>
              <span className="sr-only">{t('Loading preview…')}</span>
              <span aria-hidden="true" className="site-preview-shimmer absolute inset-0" />
            </>
          )}
        </div>
      )}
    </div>
  )
}
