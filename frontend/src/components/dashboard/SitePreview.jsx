import { useEffect, useRef, useState } from 'react'
import { getSite, getPublicSite } from '../../api/sites.js'
import { schemaToResponsiveHtml } from '../../utils/responsiveHtml.js'
import { withoutExecutableScripts } from '../../utils/htmlRuntime.js'

// A live, scaled-down thumbnail of a site's home page (the "Minecraft map"
// under the title). Lazy: only fetches + renders once the card scrolls near
// view (IntersectionObserver). Inert: scripts are stripped AND the iframe is
// fully sandboxed, so a thumbnail can never run code or be clicked into. The
// built document is cached per site id so re-mounts don't refetch.

const LOGICAL_W = 1200
const cache = new Map() // site.id -> html doc string

function buildDoc(site) {
  const raw = site.html && site.html.trim()
    ? site.html
    : schemaToResponsiveHtml(site.schema, site.title)
  return withoutExecutableScripts(raw)
}

export default function SitePreview({ site, height = 150, source = 'owner' }) {
  const boxRef = useRef(null)
  const [doc, setDoc] = useState(() => cache.get(site.id) || null)
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(360)
  const [failed, setFailed] = useState(false)

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

  // Track the box width so the page can be scaled to fit it.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const update = () => setWidth(el.clientWidth || 360)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  const scale = width / LOGICAL_W

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-xl border border-[#eef0f3] bg-[#f7f8fa]"
      style={{ height }}
    >
      {doc ? (
        <iframe
          title={`preview-${site.id}`}
          srcDoc={doc}
          sandbox=""
          tabIndex={-1}
          aria-hidden
          style={{
            width: LOGICAL_W,
            height: Math.round(height / (scale || 1)),
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            background: '#ffffff',
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-[#c4c8cf]">
          {failed ? 'No preview' : 'Loading preview…'}
        </div>
      )}
    </div>
  )
}
