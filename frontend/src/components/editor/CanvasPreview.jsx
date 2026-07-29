import { useEffect, useRef, useState } from 'react'
import { Renderer } from '../renderer/Renderer.jsx'
import { canvasHeight, flowCanvasHeight } from '../renderer/layout.js'
import { HTML_ALLOW, PUBLIC_HTML_SANDBOX } from '../../utils/htmlRuntime.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { PAGE_SHEET_SHADOW } from './pageSheet.js'
import PhoneFrame from './PhoneFrame.jsx'
import { phoneFrameH, phoneFrameW, phoneModel, phoneScreenHeight } from './phoneFrameMetrics.js'
import BrowserFrame from './BrowserFrame.jsx'
import MobileBrowserChrome from './MobileBrowserChrome.jsx'
import { browserFrameH, browserFrameW, mobileBrowserChromeH } from './browserFrameMetrics.js'

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
  browserFrame = false,
  browserSiteTitle = 'My Site',
  browserFavicon = '',
  browserAddress = 'preview.sitebuilder.local',
  browserPages = [],
  browserCurrentPageId = '',
  onBrowserPageSelect,
  onBrowserPageEdit,
  onBrowserFaviconEdit,
  onBrowserAddressChange,
}) {
  const { t } = useLanguage()
  const workspaceRef = useRef(null)
  const [workspace, setWorkspace] = useState({ w: 0, h: 0 })
  const mobile = viewport === 'mobile'
  const desktopBrowser = !mobile && browserFrame
  const mobileBrowser = mobile && browserFrame
  const phone = phoneModel(width, fold)
  const mobileChromeH = mobileBrowser ? mobileBrowserChromeH(phone) : 0
  const bezelW = mobile ? phoneFrameW(phone) : desktopBrowser ? browserFrameW() : 0
  const bezelH = mobile ? phoneFrameH(phone) : desktopBrowser ? browserFrameH() : 0
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
    // The device body, in design pixels — the same arithmetic the Edit canvas
    // uses, so both fit-scale to the same size. The iframe itself is exactly
    // `width` wide: its layout viewport is its CSS width, so the page must get
    // the phone's screen width and not the bezel's, or every media query and
    // centered row here would resolve differently than in Edit.
    const frameW = width + bezelW
    const scale = workspace.w ? Math.min(1, workspace.w / frameW) : 1
    // The iframe's own viewport height (before the fit-scale) — tall enough to
    // fill the panel so there is a real scroll region for pinned content.
    const viewportH = Math.max(
      360,
      Math.round((workspace.h || 560) / scale) - bezelH,
    )
    const frameH = viewportH + bezelH
    // This one IS a device viewport — the page scrolls inside it — so the
    // browser chrome takes its room from the page, the way it does on a phone.
    const pageH = Math.max(200, viewportH - mobileChromeH)
    const inner = (
      <iframe
        title={title}
        srcDoc={iframeHtml}
        sandbox={PUBLIC_HTML_SANDBOX}
        allow={HTML_ALLOW}
        allowFullScreen
        className="block border-0 bg-white"
        style={{ width, height: pageH }}
      />
    )
    return (
      <main
        ref={workspaceRef}
        data-testid="component-view-workspace"
        className="min-h-0 flex-1 overflow-hidden bg-[var(--studio-shell)] p-8"
      >
        <div
          className="mx-auto"
          data-builder-preview-scale={scale}
          data-builder-preview-artboard
          style={{ width: frameW * scale, height: frameH * scale }}
        >
          <div
            style={{
              width: frameW,
              transform: scale < 1 ? `scale(${scale})` : undefined,
              transformOrigin: 'top left',
            }}
          >
            {mobile ? (
              <PhoneFrame screenWidth={width} screenHeight={viewportH} model={phone}>
                {mobileBrowser ? (
                  <MobileBrowserChrome
                    screenWidth={width}
                    screenHeight={pageH}
                    model={phone}
                    siteTitle={browserSiteTitle}
                    favicon={browserFavicon}
                    address={browserAddress}
                    pages={browserPages}
                    currentPageId={browserCurrentPageId || page?.id}
                    onSelectPage={onBrowserPageSelect}
                    onEditPage={onBrowserPageEdit}
                    onEditFavicon={onBrowserFaviconEdit}
                    onAddressChange={onBrowserAddressChange}
                  >
                    {inner}
                  </MobileBrowserChrome>
                ) : inner}
              </PhoneFrame>
            ) : desktopBrowser ? (
              <BrowserFrame
                screenWidth={width}
                screenHeight={viewportH}
                siteTitle={browserSiteTitle}
                favicon={browserFavicon}
                address={browserAddress}
                pages={browserPages}
                currentPageId={browserCurrentPageId || page?.id}
                onSelectPage={onBrowserPageSelect}
                onEditPage={onBrowserPageEdit}
                onEditFavicon={onBrowserFaviconEdit}
                onAddressChange={onBrowserAddressChange}
              >
                {inner}
              </BrowserFrame>
            ) : (
              <div className="bg-white" style={{ boxShadow: PAGE_SHEET_SHADOW }}>
                {inner}
              </div>
            )}
          </div>
        </div>
      </main>
    )
  }

  // Plain component pages (no pinned/JS content) render the React tree directly,
  // scaled to fit the panel width; the workspace scrolls vertically through the
  // full (scaled) page — the lighter path, identical output to the edit canvas.
  //
  // On mobile that means a real device: the screen is the size of the screen the
  // user picked and the design scrolls inside it, matching both the edit canvas
  // and the iframe path above. Desktop keeps the tall artboard.
  const deviceH = mobile ? (fold > 0 ? fold : phoneScreenHeight(width)) : 0
  const devicePageH = Math.max(200, deviceH - mobileChromeH)
  const frameWidth = width + bezelW
  const frameHeight = (mobile ? deviceH : artboardHeight) + bezelH
  const scale = workspace.w ? Math.min(1, workspace.w / frameWidth) : 1
  const pageContent = (
    <div
      data-builder-preview-artboard
      className={mobile ? '' : 'bg-white'}
      style={{
        position: 'relative',
        width,
        minHeight: mobile ? Math.max(artboardHeight, devicePageH) : artboardHeight,
        overflowX: 'clip',
        ...(mobile ? {} : { boxShadow: PAGE_SHEET_SHADOW }),
      }}
    >
      <Renderer
        components={components}
        background={background}
        viewport={viewport}
        width={width}
        designWidth={width}
        flowMode={flowMode}
      />
      {/* Same as the edit canvas: on the phone the screen's bottom edge already
          IS the fold, so a dashed rule across the design says nothing. */}
      {fold > 0 && !mobile && (
        <div className="pointer-events-none absolute inset-x-0" style={{ top: fold, zIndex: 40 }}>
          <div className="border-t-2 border-dashed border-amber-500" />
          <span className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
            {t('Visible screen limit')} · {fold}px
          </span>
        </div>
      )}
    </div>
  )

  // The phone's screen: a fixed viewport the design scrolls inside, so View
  // shows the same thing the visitor's thumb will.
  const deviceScreen = (
    <div
      data-builder-device-viewport={deviceH}
      className="overflow-x-hidden overflow-y-auto"
      style={{
        width,
        height: devicePageH,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(15,23,42,.28) transparent',
      }}
    >
      {pageContent}
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
            <PhoneFrame screenWidth={width} screenHeight={deviceH} model={phone}>
              {mobileBrowser ? (
                <MobileBrowserChrome
                  screenWidth={width}
                  screenHeight={devicePageH}
                  model={phone}
                  siteTitle={browserSiteTitle}
                  favicon={browserFavicon}
                  address={browserAddress}
                  pages={browserPages}
                  currentPageId={browserCurrentPageId || page?.id}
                  onSelectPage={onBrowserPageSelect}
                  onEditPage={onBrowserPageEdit}
                  onEditFavicon={onBrowserFaviconEdit}
                  onAddressChange={onBrowserAddressChange}
                >
                  {deviceScreen}
                </MobileBrowserChrome>
              ) : deviceScreen}
            </PhoneFrame>
          ) : desktopBrowser ? (
            <BrowserFrame
              screenWidth={width}
              screenHeight={artboardHeight}
              siteTitle={browserSiteTitle}
              favicon={browserFavicon}
              address={browserAddress}
              pages={browserPages}
              currentPageId={browserCurrentPageId || page?.id}
              onSelectPage={onBrowserPageSelect}
              onEditPage={onBrowserPageEdit}
              onEditFavicon={onBrowserFaviconEdit}
              onAddressChange={onBrowserAddressChange}
            >
              {pageContent}
            </BrowserFrame>
          ) : pageContent}
        </div>
      </div>
    </main>
  )
}
