import { useEffect, useRef, useState } from 'react'
import { Renderer } from '../renderer/Renderer.jsx'
import { canvasHeight, flowCanvasHeight } from '../renderer/layout.js'
import { HTML_ALLOW, PUBLIC_HTML_SANDBOX } from '../../utils/htmlRuntime.js'
import { useLanguage } from '../../i18n/useLanguage.js'

const WORKSPACE_PADDING = 64
const PHONE_FRAME = 24

// Read-only component preview using the same centered, auto-fit artboard model
// as the Edit canvas. Large resolutions scale down instead of making the
// editor workspace scroll horizontally.
export default function CanvasPreview({
  page,
  viewport,
  width,
  fold = 0,
  background = '#ffffff',
  iframeHtml = '',
  title = 'Page preview',
}) {
  const { t } = useLanguage()
  const workspaceRef = useRef(null)
  const [workspaceWidth, setWorkspaceWidth] = useState(0)
  const mobile = viewport === 'mobile'
  const components = page?.components || []
  const flowMode = !!page?.flowMode
  const contentHeight = flowMode
    ? flowCanvasHeight(components, viewport, width)
    : canvasHeight(components, viewport)
  const artboardHeight = fold > 0 ? Math.max(contentHeight, fold + 40) : contentHeight
  const frameWidth = width + (mobile ? PHONE_FRAME : 0)
  const frameHeight = artboardHeight + (mobile ? PHONE_FRAME : 0)

  useEffect(() => {
    const element = workspaceRef.current
    if (!element) return undefined
    const update = () => setWorkspaceWidth(Math.max(1, element.clientWidth - WORKSPACE_PADDING))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [mobile])

  const scale = workspaceWidth ? Math.min(1, workspaceWidth / frameWidth) : 1
  const pageContent = (
    <div
      data-builder-preview-artboard
      className={mobile ? '' : 'bg-white shadow-sm'}
      style={{ position: 'relative', width, minHeight: artboardHeight, overflowX: 'clip' }}
    >
      {iframeHtml ? (
        <iframe
          title={title}
          srcDoc={iframeHtml}
          sandbox={PUBLIC_HTML_SANDBOX}
          allow={HTML_ALLOW}
          allowFullScreen
          className="block border-0 bg-white"
          style={{ width, height: artboardHeight }}
        />
      ) : (
        <Renderer
          components={components}
          background={background}
          viewport={viewport}
          width={width}
          designWidth={width}
          flowMode={flowMode}
        />
      )}
      {fold > 0 && (
        <div className="pointer-events-none absolute inset-x-0" style={{ top: fold, zIndex: 40 }}>
          <div className="border-t-2 border-dashed border-amber-500" />
          <span className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
            {t('Visible screen limit')} · {fold}px
          </span>
        </div>
      )}
    </div>
  )

  return (
    <main
      ref={workspaceRef}
      data-testid="component-view-workspace"
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-8"
    >
      <div
        className="mx-auto"
        data-builder-preview-scale={scale}
        style={{ width: frameWidth * scale, height: frameHeight * scale }}
      >
        <div
          style={{
            width: frameWidth,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
          }}
        >
          {mobile ? (
            <div
              className="overflow-hidden rounded-[44px] border-[12px] border-gray-900 bg-white shadow-2xl"
              style={{ width: frameWidth }}
            >
              {pageContent}
            </div>
          ) : pageContent}
        </div>
      </div>
    </main>
  )
}
