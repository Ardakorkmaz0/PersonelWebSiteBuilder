import { useEffect, useMemo, useRef, useState } from 'react'
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
import PreviewScrollIndicator from './PreviewScrollIndicator.jsx'

const WORKSPACE_PADDING = 64
// Edit keeps this strip free for the device caption below the phone. View has
// no caption, but reserving the same room makes the physical mockup stay the
// same size when the user switches between Edit and View.
const MOBILE_CAPTION_ROOM = 44
const PREVIEW_SCROLL_MESSAGE = 'pwb-preview-scroll'

function newPreviewScrollToken(source = '') {
  const sourceHint = String(source).length.toString(36)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `preview-${sourceHint}-${crypto.randomUUID()}`
  }
  return `preview-${sourceHint}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

// View's exported-page route deliberately keeps iframe documents opaque. The
// bridge therefore reports only non-sensitive scroll geometry to its parent;
// the parent also verifies both the source Window and this per-preview token.
function withPreviewScrollReporter(html, token) {
  const safeToken = JSON.stringify(String(token)).replace(/</g, '\\u003c')
  const reporter = `<script data-pwb-preview-scroll-reporter>
  (function () {
    var token = ${safeToken};
    var queued = false;
    var observer;
    function number(value) { return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0; }
    function report() {
      queued = false;
      var root = document.documentElement;
      var body = document.body;
      var content = Math.max(
        root ? root.scrollHeight : 0,
        root ? root.offsetHeight : 0,
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0
      );
      try {
        parent.postMessage({
          type: '${PREVIEW_SCROLL_MESSAGE}',
          token: token,
          scrollTop: number(window.scrollY || window.pageYOffset || (root && root.scrollTop) || (body && body.scrollTop)),
          viewportHeight: number(window.innerHeight || (root && root.clientHeight)),
          contentHeight: number(content)
        }, '*');
      } catch (error) { /* preview stays usable if its parent is unavailable */ }
    }
    function schedule() {
      if (queued) return;
      queued = true;
      if (window.requestAnimationFrame) window.requestAnimationFrame(report);
      else setTimeout(report, 0);
    }
    function observe() {
      schedule();
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      if (window.ResizeObserver) {
        observer = new ResizeObserver(schedule);
        if (document.documentElement) observer.observe(document.documentElement);
        if (document.body) observer.observe(document.body);
      }
      if (window.MutationObserver && document.documentElement) {
        new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
    else observe();
  })();</script>`
  // Exported HTML can contain an HTML Embed with its own literal `srcdoc`
  // document. Its `</body>` must stay untouched: changing the first match
  // would put this script inside the attribute and corrupt the outer page.
  // The last closing body belongs to the document loaded by our preview iframe.
  const closingBodyIndex = String(html).toLowerCase().lastIndexOf('</body>')
  return closingBodyIndex >= 0
    ? `${html.slice(0, closingBodyIndex)}${reporter}${html.slice(closingBodyIndex)}`
    : `${html}${reporter}`
}

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
  const deviceScrollRef = useRef(null)
  const iframeRef = useRef(null)
  const [workspace, setWorkspace] = useState({ w: 0, h: 0 })
  const [iframeScroll, setIframeScroll] = useState(null)
  const iframeScrollToken = useMemo(() => newPreviewScrollToken(iframeHtml), [iframeHtml])
  const iframeSrcDoc = useMemo(
    () => (iframeHtml ? withPreviewScrollReporter(iframeHtml, iframeScrollToken) : ''),
    [iframeHtml, iframeScrollToken],
  )
  const mobile = viewport === 'mobile'
  const desktopBrowser = !mobile && browserFrame
  const mobileBrowser = mobile && browserFrame
  const phone = phoneModel(width, fold)
  const mobileChromeH = mobileBrowser ? mobileBrowserChromeH(phone) : 0
  const bezelW = mobile ? phoneFrameW(phone) : desktopBrowser ? browserFrameW() : 0
  const bezelH = mobile ? phoneFrameH(phone) : desktopBrowser ? browserFrameH() : 0
  const components = page?.components || []
  const flowMode = !!page?.flowMode
  const showScrollIndicator = page?.showScrollIndicator !== false
  const contentHeight = flowMode
    ? flowCanvasHeight(components, viewport, width)
    : canvasHeight(components, viewport)
  // A phone is a fixed viewport, not a page-height guide. Its inner document
  // only needs to reach the visible page area (or real content when longer),
  // exactly like the editable Canvas. Desktop retains the fold guide + margin
  // because it is a scrollable artboard rather than a device.
  const artboardHeight = mobile
    ? contentHeight
    : fold > 0 ? Math.max(contentHeight, fold + 40) : contentHeight

  useEffect(() => {
    const element = workspaceRef.current
    if (!element) return undefined
    const update = () =>
      setWorkspace({
        w: Math.max(1, element.clientWidth - WORKSPACE_PADDING),
        h: Math.max(
          1,
          element.clientHeight - WORKSPACE_PADDING - (mobile ? MOBILE_CAPTION_ROOM : 0),
        ),
      })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [mobile])

  useEffect(() => {
    if (!iframeHtml) return undefined
    const onMessage = (event) => {
      const frame = iframeRef.current
      const data = event.data
      if (
        !frame ||
        event.source !== frame.contentWindow ||
        !data ||
        data.type !== PREVIEW_SCROLL_MESSAGE ||
        data.token !== iframeScrollToken
      ) return
      const scrollTop = Number(data.scrollTop)
      const viewportHeight = Number(data.viewportHeight)
      const contentHeight = Number(data.contentHeight)
      if (![scrollTop, viewportHeight, contentHeight].every(Number.isFinite)) return
      setIframeScroll({
        token: iframeScrollToken,
        scrollTop: Math.max(0, scrollTop),
        viewportHeight: Math.max(0, viewportHeight),
        contentHeight: Math.max(0, contentHeight),
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iframeHtml, iframeScrollToken])

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
    const widthScale = workspace.w ? Math.min(1, workspace.w / frameW) : 1
    // Phones use the selected device height; desktop keeps using the available
    // workspace height as a resizable mini-browser viewport.
    const viewportH = mobile
      ? (fold > 0 ? fold : phoneScreenHeight(width))
      : Math.max(360, Math.round((workspace.h || 560) / widthScale) - bezelH)
    const frameH = viewportH + bezelH
    const scale = Math.min(
      1,
      widthScale,
      mobile && workspace.h ? workspace.h / frameH : 1,
    )
    // This one IS a device viewport — the page scrolls inside it — so the
    // browser chrome takes its room from the page, the way it does on a phone.
    const pageH = Math.max(200, viewportH - mobileChromeH)
    const iframe = (
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={iframeSrcDoc}
        sandbox={PUBLIC_HTML_SANDBOX}
        allow={HTML_ALLOW}
        allowFullScreen
        className="block border-0 bg-white"
        style={{ width, height: pageH }}
      />
    )
    // The export iframe keeps its native scrollbar at zero width so a phone
    // layout never loses design pixels. The outer cue is therefore deliberate:
    // it is visible in View without changing the iframe's layout width.
    const inner = mobile ? (
      <div className="relative" style={{ width, height: pageH }}>
        {iframe}
        <PreviewScrollIndicator
          enabled={showScrollIndicator}
          contentHeight={contentHeight}
          viewportHeight={pageH}
          externalScrollTop={iframeScroll?.token === iframeScrollToken ? iframeScroll.scrollTop : undefined}
          externalContentHeight={iframeScroll?.token === iframeScrollToken ? iframeScroll.contentHeight : undefined}
          externalViewportHeight={iframeScroll?.token === iframeScrollToken ? iframeScroll.viewportHeight : undefined}
        />
      </div>
    ) : iframe
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
  // scaled to fit the panel; the workspace scrolls vertically through the full
  // (scaled) desktop page — the lighter path, identical output to Edit.
  //
  // On mobile that means a real device: the screen is the size of the screen the
  // user picked and the design scrolls inside it, matching both the edit canvas
  // and the iframe path above. Desktop keeps the tall artboard.
  const deviceH = mobile ? (fold > 0 ? fold : phoneScreenHeight(width)) : 0
  const devicePageH = Math.max(200, deviceH - mobileChromeH)
  const frameWidth = width + bezelW
  const frameHeight = (mobile ? deviceH : artboardHeight) + bezelH
  const scale = Math.min(
    1,
    workspace.w ? workspace.w / frameWidth : 1,
    mobile && workspace.h ? workspace.h / frameHeight : 1,
  )
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
    <div className="relative" style={{ width, height: devicePageH }}>
      <div
        ref={deviceScrollRef}
        data-builder-scroll-host
        data-builder-device-viewport={deviceH}
        className="h-full overflow-x-hidden overflow-y-auto"
        style={{
          width,
          height: devicePageH,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {pageContent}
      </div>
      <PreviewScrollIndicator
        enabled={showScrollIndicator}
        scrollRef={deviceScrollRef}
        contentHeight={Math.max(artboardHeight, devicePageH)}
        viewportHeight={devicePageH}
      />
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
