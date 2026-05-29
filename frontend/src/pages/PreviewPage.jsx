import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPublicSite } from '../api/sites.js'
import { Renderer, canvasHeight } from '../components/renderer/Renderer.jsx'
import { CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../components/registry.jsx'

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
  const designW = isMobileView
    ? page.mobileWidth || MOBILE_CANVAS_WIDTH
    : page.canvasWidth || CANVAS_WIDTH
  const background = isMobileView
    ? page.backgroundMobile || page.background || '#ffffff'
    : page.background || '#ffffff'
  // Mobile fills the phone width (modest upscale cap); desktop only scales down.
  const scale = isMobileView
    ? Math.min(width / designW, 1.1)
    : Math.min(1, width / designW)
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
          />
        </div>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  const { slug } = useParams()
  const [site, setSite] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ok | notfound | error

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

  const page = site?.schema?.pages?.[0] || {}

  return <ResponsiveSite page={page} />
}
