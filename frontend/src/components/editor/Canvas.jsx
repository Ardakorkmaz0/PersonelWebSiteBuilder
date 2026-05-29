import { useDroppable } from '@dnd-kit/core'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { canvasHeight } from '../renderer/layout.js'
import { CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../registry.jsx'
import FreeCanvasItem from './FreeCanvasItem.jsx'

// One editable free canvas, rendered at the active breakpoint's chosen artboard
// width. PC edits each component's `layout`; Mobile edits its `mobileLayout` on a
// true device-width phone canvas (1:1, no scaling) — independent designs. The
// "fold" guide (if set) marks the visible screen height for the chosen device.
export default function Canvas() {
  const components = useEditorStore((s) => selectCurrentPage(s).components)
  const viewport = useEditorStore((s) => s.viewport)
  const bg = useEditorStore((s) => selectCurrentPage(s).background || '#ffffff')
  const bgMobile = useEditorStore(
    (s) =>
      selectCurrentPage(s).backgroundMobile ||
      selectCurrentPage(s).background ||
      '#ffffff',
  )
  const pcWidth = useEditorStore((s) => selectCurrentPage(s).canvasWidth || CANVAS_WIDTH)
  const pcFold = useEditorStore((s) => selectCurrentPage(s).canvasFold || 0)
  const mobileWidth = useEditorStore(
    (s) => selectCurrentPage(s).mobileWidth || MOBILE_CANVAS_WIDTH,
  )
  const mobileFold = useEditorStore((s) => selectCurrentPage(s).mobileFold || 0)
  const select = useEditorStore((s) => s.selectComponent)
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })

  const isMobile = viewport === 'mobile'
  const canvasW = isMobile ? mobileWidth : pcWidth
  const fold = isMobile ? mobileFold : pcFold
  const background = isMobile ? bgMobile : bg
  const contentH = canvasHeight(components, viewport)
  const minHeight = fold > 0 ? Math.max(contentH, fold + 40) : contentH

  const canvas = (
    <div
      id="free-canvas"
      ref={setNodeRef}
      onPointerDown={() => select(null)}
      style={{ position: 'relative', width: canvasW, minHeight, background }}
      className={`${isMobile ? '' : 'shadow-sm'} ${
        isOver ? 'ring-2 ring-[#2b579a]' : ''
      }`}
    >
      {components.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center text-gray-400">
          <p className="text-lg font-medium">Your canvas is empty</p>
          <p className="text-sm">
            Drag a component from the left onto the canvas.
          </p>
        </div>
      )}
      {components.map((component) => (
        <FreeCanvasItem key={component.id} component={component} />
      ))}

      {fold > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0"
          style={{ top: fold, zIndex: 40 }}
        >
          <div className="border-t-2 border-dashed border-amber-500" />
          <span className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
            Visible screen limit · {fold}px
          </span>
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <main className="flex-1 overflow-auto bg-gray-100 p-8">
        <div className="mx-auto w-fit">
          <div
            className="overflow-hidden rounded-[44px] border-[12px] border-gray-900 bg-white shadow-2xl"
            style={{ width: canvasW + 24 }}
          >
            {canvas}
          </div>
          <p className="mt-3 max-w-[360px] text-center text-xs text-gray-400">
            Mobile layout ({canvasW}px) — a separate design from PC. Drag &amp;
            resize freely, or use "Auto-arrange" in the panel.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto bg-gray-100 p-8">
      <div className="mx-auto w-fit">{canvas}</div>
    </main>
  )
}
