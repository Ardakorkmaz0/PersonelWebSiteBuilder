import { useEffect, useRef, useState } from 'react'
import { Renderer } from '../renderer/Renderer.jsx'
import { canvasHeight, flowCanvasHeight } from '../renderer/layout.js'
import { HTML_ALLOW, PUBLIC_HTML_SANDBOX } from '../../utils/htmlRuntime.js'
import { useLanguage } from '../../i18n/useLanguage.js'

const WORKSPACE_PADDING = 64

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
  const [workspace, setWorkspace] = useState({ w: 0, h: 0 })
  const mobile = viewport === 'mobile'
  const components = page?.components || []
  const flowMode = !!page?.flowMode
  const contentHeight = flowMode
    ? flowCanvasHeight(components, viewport, width)
    : canvasHeight(components, viewport)
  const artboardHeight = fold > 0 ? Math.max(contentHeight, fold + 40) : contentHeight

  useEffect(() => {
    const element = workspaceRef.current
    if (!element) return undefined
    const update = () =>
      setWorkspace({
        w: Math.max(1, element.clientWidth - WORKSPACE_PADDING),
        h: Math.max(1, element.clientHeight - WORKSPACE_PADDING),
      })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [mobile])

  // Fixed/sticky/JS pages render through the exported HTML in an iframe — like
  // the published Preview, but sized to the workspace so it is a real scrolling
  // MINI-BROWSER: the page scrolls INSIDE the iframe (its own viewport), so a
  // pinned navbar actually sticks and the page is shown at a usable size, not a
  // shrunk static snapshot. Matches what /site/:slug does with a full-window
  // iframe, just inside the editor panel.
  if (iframeHtml) {
    const frameW = width + (mobile ? 24 : 0)
    const scale = workspace.w ? Math.min(1, workspace.w / frameW) : 1
    // The iframe's own viewport height (before the fit-scale) — tall enough to
    // fill the panel so there is a real scroll region for pinned content.
    const viewportH = Math.max(360, Math.round((workspace.h || 560) / scale))
    const boxW = frameW * scale
    const boxH = viewportH * scale
    const inner = (
      <iframe
        title={title}
        srcDoc={iframeHtml}
        sandbox={PUBLIC_HTML_SANDBOX}
        allow={HTML_ALLOW}
        allowFullScreen
        className="block border-0 bg-white"
        style={{
          width: frameW,
          height: viewportH,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
        }}
      />
    )
    return (
      <main
        ref={workspaceRef}
        data-testid="component-view-workspace"
        className="min-h-0 flex-1 overflow-hidden bg-[var(--studio-shell)] p-8"
      >
        <div
          className="mx-auto overflow-hidden bg-white shadow-sm"
          data-builder-preview-scale={scale}
          data-builder-preview-artboard
          style={mobile
            ? { width: boxW, height: boxH, borderRadius: 44, border: '12px solid #111827', boxSizing: 'content-box' }
            : { width: boxW, height: boxH }}
        >
          {inner}
        </div>
      </main>
    )
  }

  // Plain component pages (no pinned/JS content) render the React tree directly,
  // scaled to fit the panel width; the workspace scrolls vertically through the
  // full (scaled) page — the lighter path, identical output to the edit canvas.
  const frameWidth = width + (mobile ? 24 : 0)
  const frameHeight = artboardHeight + (mobile ? 24 : 0)
  const scale = workspace.w ? Math.min(1, workspace.w / frameWidth) : 1
  const pageContent = (
    <div
      data-builder-preview-artboard
      className={mobile ? '' : 'bg-white shadow-sm'}
      style={{ position: 'relative', width, minHeight: artboardHeight, overflowX: 'clip' }}
    >
      <Renderer
        components={components}
        background={background}
        viewport={viewport}
        width={width}
        designWidth={width}
        flowMode={flowMode}
      />
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
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--studio-shell)] p-8"
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
