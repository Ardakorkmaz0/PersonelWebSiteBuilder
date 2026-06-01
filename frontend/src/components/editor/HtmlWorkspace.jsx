import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { HTML_ALLOW, HTML_SANDBOX, installBuilderRuntime } from '../../utils/htmlRuntime.js'

// Editable, pixel-perfect HTML/JS workspace embedded in the site editor.
// - View: real document in a sandboxed iframe with scripts enabled.
//   NO allow-same-origin (isolated — cannot touch the app/visitor session).
// - Edit: sandbox allow-same-origin (NO scripts) + designMode for in-place text
//   editing; the parent reads the edited HTML back via the exposed getHtml().
// - Device sizes drive responsive testing; compatibility mode aids non-responsive pages.
const DEVICES = [
  { id: 'fit', label: 'Responsive - area width', w: 0, h: 0 },
  { id: 'desktop-16-9', label: 'Desktop 16:9 - 1280x720', w: 1280, h: 720 },
  { id: 'desktop-16-10', label: 'Desktop 16:10 - 1280x800', w: 1280, h: 800 },
  { id: 'laptop', label: 'Laptop - 1440x900', w: 1440, h: 900 },
  { id: 'fhd', label: 'Full HD - 1920x1080', w: 1920, h: 1080 },
  { id: 'ipad', label: 'iPad - 768x1024', w: 768, h: 1024 },
  { id: 'ipadpro', label: 'iPad Pro - 1024x1366', w: 1024, h: 1366 },
  { id: 'iphonese', label: 'iPhone SE - 375x667', w: 375, h: 667 },
  { id: 'iphone15', label: 'iPhone 15 - 393x852', w: 393, h: 852 },
  { id: 'iphonemax', label: 'iPhone Pro Max - 430x932', w: 430, h: 932 },
  { id: 'galaxys', label: 'Galaxy S - 360x780', w: 360, h: 780 },
  { id: 'galaxyultra', label: 'Galaxy Ultra - 384x824', w: 384, h: 824 },
  { id: 'android', label: 'Large Android - 412x915', w: 412, h: 915 },
]

const COMPAT_CSS = `<style id="__compat__">
  html { -webkit-text-size-adjust: 100%; }
  body { overflow-x: hidden !important; }
  img, video, svg, canvas, iframe, object, embed { max-width: 100% !important; height: auto !important; }
  table { display: block; overflow-x: auto; }
</style>`
const COMPAT_VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'

function withCompat(html) {
  const inject = COMPAT_VIEWPORT + COMPAT_CSS
  let out = String(html || '')
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, inject + '</head>')
  if (/<head[^>]*>/i.test(out)) return out.replace(/<head[^>]*>/i, (m) => m + inject)
  return inject + out
}
function HtmlWorkspace({ html, onCommit }, ref) {
  const [mode, setMode] = useState('view')
  const [deviceId, setDeviceId] = useState('fit')
  const [landscape, setLandscape] = useState(false)
  const [compat, setCompat] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [editSeed, setEditSeed] = useState(html)
  const [sourceDraft, setSourceDraft] = useState(html)

  const iframeRef = useRef(null)
  const stageRef = useRef(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const readHtml = useCallback(() => {
    if (mode === 'source') return sourceDraft
    if (mode === 'edit' && iframeRef.current?.contentDocument) {
      try {
        return '<!DOCTYPE html>\n' + iframeRef.current.contentDocument.documentElement.outerHTML
      } catch {
        return html
      }
    }
    return html
  }, [html, mode, sourceDraft])

  useImperativeHandle(ref, () => ({ getHtml: readHtml }), [readHtml])

  function switchMode(next) {
    if (next === mode) return
    const currentHtml = readHtml()
    if ((mode === 'edit' || mode === 'source') && onCommit) onCommit(currentHtml)
    if (next === 'edit') setEditSeed(currentHtml)
    if (next === 'source') setSourceDraft(currentHtml)
    setMode(next)
    setNonce((n) => n + 1)
  }

  function onIframeLoad() {
    if (mode === 'view') {
      installBuilderRuntime(iframeRef.current)
      return
    }
    if (mode === 'edit') {
      try {
        const doc = iframeRef.current.contentDocument
        doc.designMode = 'on'
      } catch {
        /* ignore */
      }
    }
  }

  const device = DEVICES.find((d) => d.id === deviceId) || DEVICES[0]
  const isFit = device.id === 'fit'
  const contentW = isFit ? Math.max(320, Math.round(stage.w - 24)) : landscape ? device.h : device.w
  const contentH = isFit
    ? Math.max(420, Math.round(stage.h - 24))
    : landscape
      ? device.w
      : device.h
  const scale = Math.min(1, (stage.w - 24) / contentW || 1, (stage.h - 24) / contentH || 1)

  const srcDoc = mode === 'view' ? (compat ? withCompat(html) : html) : editSeed
  const sandbox = mode === 'view' ? HTML_SANDBOX : 'allow-same-origin'

  const toggleBtn = (active) =>
    active ? 'rounded-[2px] bg-[#2b579a] px-2.5 py-1 text-white' : 'px-2.5 py-1 text-[#323130]'

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#e1dfdd] bg-[#faf9f8]">
        <div className="border-b border-[#e1dfdd] px-3 py-2 text-xs font-semibold uppercase text-[#605e5c]">
          Files
        </div>
        <button
          type="button"
          onClick={() => switchMode(mode === 'source' ? 'view' : 'source')}
          className={`mx-2 mt-2 flex items-center justify-between rounded-[2px] border px-2.5 py-2 text-left text-sm ${
            mode === 'source'
              ? 'border-[#2b579a] bg-[#eff3fb] text-[#201f1e]'
              : 'border-[#e1dfdd] bg-white text-[#323130] hover:border-[#8a8886]'
          }`}
        >
          <span className="font-medium">index.html</span>
          <span className="text-xs text-[#605e5c]">HTML</span>
        </button>
        <div className="mt-3 px-3 text-xs leading-relaxed text-[#605e5c]">
          View runs the site as-is. Use Edit for text changes or Source for the HTML file.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e1dfdd] bg-white px-4 py-1.5">
          <div className="flex items-center rounded-[2px] border border-[#8a8886] p-0.5 text-xs font-medium">
            <button onClick={() => switchMode('view')} className={toggleBtn(mode === 'view')}>
              View
            </button>
            <button onClick={() => switchMode('edit')} className={toggleBtn(mode === 'edit')}>
              Edit
            </button>
            <button onClick={() => switchMode('source')} className={toggleBtn(mode === 'source')}>
              Source
            </button>
          </div>
          {mode !== 'source' && (
            <>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                title="Screen / device width"
                className="rounded-[2px] border border-[#8a8886] px-2 py-1 text-xs font-medium text-[#323130] focus:border-[#2b579a] focus:outline-none"
              >
                {DEVICES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setLandscape((v) => !v)}
                disabled={isFit}
                title="Landscape / portrait"
                className="rounded-[2px] px-2 py-1.5 text-sm text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-40"
              >
                {landscape ? '⟲' : '⟳'}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-[#323130]" title="Compatibility mode: fits overflowing content to the screen (view mode)">
                <input
                  type="checkbox"
                  className="accent-[#2b579a]"
                  checked={compat}
                  onChange={(e) => {
                    setCompat(e.target.checked)
                    setNonce((n) => n + 1)
                  }}
                />
                Compatibility
              </label>
            </>
          )}
          {mode === 'source' && (
            <button
              type="button"
              onClick={() => {
                onCommit?.(sourceDraft)
                setMode('view')
                setNonce((n) => n + 1)
              }}
              className="rounded-[2px] bg-[#2b579a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e3f6f]"
            >
              Apply
            </button>
          )}
          <span className="ml-auto text-xs text-[#605e5c]">
            {mode === 'view'
              ? 'Live preview: JavaScript, links, forms, and scrolling are enabled'
              : mode === 'source'
                ? 'index.html source file'
                : 'Edit text in place'}
          </span>
        </div>

        {mode === 'source' ? (
          <main className="flex min-h-0 flex-1 flex-col bg-[#1e1e1e]">
            <div className="border-b border-white/10 bg-[#252526] px-4 py-2 font-mono text-xs text-gray-300">
              index.html
            </div>
            <textarea
              value={sourceDraft}
              onChange={(e) => setSourceDraft(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-[#1e1e1e] p-4 font-mono text-sm leading-relaxed text-gray-100 outline-none"
            />
          </main>
        ) : (
          <main
            ref={stageRef}
            className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#f3f2f1] p-3"
          >
            <div style={{ width: Math.round(contentW * scale), height: Math.round(contentH * scale) }}>
              <div
                className="bg-white"
                style={{
                  width: contentW,
                  height: contentH,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  boxShadow: isFit ? 'none' : '0 1px 6px rgba(0,0,0,0.15)',
                  border: isFit ? 'none' : '1px solid #c8c6c4',
                }}
              >
                <iframe
                  key={`${mode}-${nonce}`}
                  ref={iframeRef}
                  title="site"
                  srcDoc={srcDoc}
                  sandbox={sandbox}
                  allow={HTML_ALLOW}
                  allowFullScreen
                  onLoad={onIframeLoad}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                    background: '#ffffff',
                    scrollbarGutter: 'stable',
                  }}
                />
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}

export default forwardRef(HtmlWorkspace)
