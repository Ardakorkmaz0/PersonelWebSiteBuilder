import { useEffect, useRef, useState } from 'react'
import { TEMPLATE_COUNT, TEMPLATE_LIBRARY } from '../../utils/templateLibrary.js'

// Two-level template gallery: pick a CATEGORY on the left (CV, Portfolio,
// Landing, …), browse its VARIANTS as live thumbnails in the grid. Only the
// active category's thumbnails are mounted, so the modal never renders more
// than ~10 inert iframes at once.

// Live, scaled-down preview of a static template. Sandbox has NO allow-scripts
// and NO allow-same-origin (templates are static + ours), so the thumbnail is
// inert and safe. Width is measured so the preview stays fluid in the grid.
const DESIGN_W = 1200
const DESIGN_H = 860

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
        loading="lazy"
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

// Modal gallery. onPick(variant) is called with the chosen variant — its
// .build(title) returns the full HTML the caller stores as the site.
export default function TemplatePicker({ open, title, onPick, onClose }) {
  const [activeId, setActiveId] = useState(TEMPLATE_LIBRARY[0].id)
  if (!open) return null
  const active = TEMPLATE_LIBRARY.find((c) => c.id === activeId) || TEMPLATE_LIBRARY[0]
  const siteTitle = title || 'My Site'
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[6px] border border-[#e1dfdd] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e1dfdd] px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-[#201f1e]">
              Template gallery
              <span className="ml-2 rounded-full bg-[#eff3fb] px-2 py-0.5 text-xs font-semibold text-[#2b579a]">
                {TEMPLATE_COUNT} templates
              </span>
            </h2>
            <p className="text-xs text-[#605e5c]">
              Pick a category, then a style — every template is responsive HTML you can fully edit afterwards.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-[2px] px-2 py-1 text-sm text-[#605e5c] hover:bg-[#f3f2f1]"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Category rail */}
          <aside className="w-56 shrink-0 overflow-y-auto border-r border-[#e1dfdd] bg-[#faf9f8] p-2">
            {TEMPLATE_LIBRARY.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveId(cat.id)}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-[4px] px-3 py-2.5 text-left text-sm transition ${
                  cat.id === activeId
                    ? 'bg-[#2b579a] text-white shadow-sm'
                    : 'text-[#323130] hover:bg-[#f3f2f1]'
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{cat.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    cat.id === activeId ? 'bg-white/20 text-white' : 'bg-[#edebe9] text-[#605e5c]'
                  }`}
                >
                  {cat.variants.length}
                </span>
              </button>
            ))}
          </aside>

          {/* Variant grid for the active category */}
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[#201f1e]">
                {active.icon} {active.name}
                <span className="ml-2 text-xs font-normal text-[#605e5c]">{active.desc}</span>
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {active.variants.map((tpl) => (
                <div
                  key={tpl.id}
                  className="group flex flex-col overflow-hidden rounded-[4px] border border-[#e1dfdd] transition hover:border-[#2b579a] hover:shadow-lg"
                >
                  <Thumb html={tpl.build(siteTitle)} />
                  <div className="flex flex-1 flex-col p-3">
                    <div className="text-sm font-semibold text-[#201f1e]">{tpl.name}</div>
                    <p className="mt-0.5 flex-1 text-xs leading-relaxed text-[#605e5c]">{tpl.desc}</p>
                    <button
                      onClick={() => onPick(tpl)}
                      className="mt-3 rounded-[2px] bg-[#2b579a] px-3 py-1.5 text-sm font-semibold text-white opacity-90 transition hover:bg-[#1e3f6f] group-hover:opacity-100"
                    >
                      Use this template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
