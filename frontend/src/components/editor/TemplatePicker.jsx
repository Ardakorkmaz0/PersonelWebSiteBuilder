import { useEffect, useRef, useState } from 'react'
import { SITE_TEMPLATES } from '../../utils/htmlTemplates.js'

// Live, scaled-down preview of a static template. Sandbox has NO allow-scripts
// and NO allow-same-origin (templates are static + ours), so the thumbnail is
// inert and safe. Width is measured so the preview stays fluid in the grid.
const DESIGN_W = 1200
const DESIGN_H = 820

function Thumb({ html }) {
  const boxRef = useRef(null)
  const [scale, setScale] = useState(0.3)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    // Only update when we have a real width, so a transient 0 (during mount or a
    // collapsed parent) never produces an invisible scale(0) thumbnail.
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setScale(w / DESIGN_W)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden border-b border-[#e1dfdd] bg-white"
      style={{ aspectRatio: `${DESIGN_W} / ${DESIGN_H}` }}
    >
      <iframe
        title="template preview"
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        scrolling="no"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// Modal grid of ready-made responsive HTML templates. onPick(tpl) is called with
// the chosen template; the caller turns it into the site's HTML.
export default function TemplatePicker({ open, title, onPick, onClose }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2px] border border-[#e1dfdd] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e1dfdd] px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-[#201f1e]">
              Hazır responsive şablonlar
            </h2>
            <p className="text-xs text-[#605e5c]">
              Bir şablon seç — tüm cihazlarda uyumlu HTML olarak yüklenir, sonra
              düzenleyebilirsin.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-[2px] px-2 py-1 text-sm text-[#605e5c] hover:bg-[#f3f2f1]"
          >
            ✕
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          {SITE_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col overflow-hidden rounded-[2px] border border-[#e1dfdd] transition hover:border-[#2b579a] hover:shadow-md"
            >
              <Thumb html={tpl.build(title || 'My Site')} />
              <div className="flex flex-1 flex-col p-3">
                <div className="text-sm font-semibold text-[#201f1e]">
                  {tpl.name}
                </div>
                <p className="mt-0.5 flex-1 text-xs text-[#605e5c]">{tpl.desc}</p>
                <button
                  onClick={() => onPick(tpl)}
                  className="mt-3 rounded-[2px] bg-[#2b579a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e3f6f]"
                >
                  Bu şablonu kullan
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
