import { useDroppable } from '@dnd-kit/core'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { canvasHeight, flowCanvasHeight, flowGap, flowSidePad } from '../renderer/layout.js'
import { CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../registry.jsx'
import FreeCanvasItem from './FreeCanvasItem.jsx'
import FlowCanvasItem from './FlowCanvasItem.jsx'

// One editable free canvas, rendered at the active breakpoint's chosen artboard
// width. PC edits each component's `layout`; Mobile edits its `mobileLayout` on a
// true device-width phone canvas (1:1, no scaling) — independent designs. The
// "fold" guide (if set) marks the visible screen height for the chosen device.
export default function Canvas() {
  const page = useEditorStore(selectCurrentPage)
  const components = page.components
  const viewport = useEditorStore((s) => s.viewport)
  const bg = page.background || '#ffffff'
  const bgMobile = page.backgroundMobile || page.background || '#ffffff'
  const pcWidth = page.canvasWidth || CANVAS_WIDTH
  const pcFold = page.canvasFold || 0
  const mobileWidth = page.mobileWidth || MOBILE_CANVAS_WIDTH
  const mobileFold = page.mobileFold || 0
  const select = useEditorStore((s) => s.selectComponent)
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })

  const isMobile = viewport === 'mobile'
  const flowMode = !!page.flowMode
  const dragGuides = useEditorStore((s) => s.dragGuides)
  const canvasW = isMobile ? mobileWidth : pcWidth
  const sidePad = flowSidePad(viewport)
  const fold = isMobile ? mobileFold : pcFold
  const background = isMobile ? bgMobile : bg
  const contentH = flowMode ? flowCanvasHeight(components, viewport, canvasW) : canvasHeight(components, viewport)
  const minHeight = fold > 0 ? Math.max(contentH, fold + 40) : contentH

  const canvas = (
    <div
      id="free-canvas"
      ref={setNodeRef}
      onPointerDown={() => select(null)}
      style={{
        position: 'relative',
        width: canvasW,
        minHeight,
        background,
        // Clip selection chrome (resize handles, outline) and any off-artboard
        // content at the canvas edge so you can't scroll into empty space beside
        // the page. Vertical content is unaffected (clip is X-only).
        overflowX: 'clip',
        ...(flowMode
          ? {
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              alignContent: 'flex-start',
              justifyContent: 'flex-start',
              gap: flowGap(viewport),
              padding: `0 ${sidePad}px`,
              boxSizing: 'border-box',
            }
          : {}),
      }}
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
      {components.map((component) =>
        flowMode ? (
          <FlowCanvasItem key={component.id} component={component} canvasWidth={canvasW} />
        ) : (
          <FreeCanvasItem key={component.id} component={component} />
        ),
      )}

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

      {/* Live snap guides rendered during free-canvas drags. Each guide is a
          dashed magenta line at the snapped edge/centre coordinate, extending
          across the whole artboard so the alignment is obvious. */}
      {!flowMode && dragGuides && dragGuides.length > 0 &&
        dragGuides.map((g, i) =>
          g.type === 'v' ? (
            <div
              key={`v${i}`}
              className="pointer-events-none absolute"
              style={{
                left: g.pos,
                top: 0,
                bottom: 0,
                width: 0,
                borderLeft: '1px dashed #ec4899',
                zIndex: 45,
              }}
            />
          ) : (
            <div
              key={`h${i}`}
              className="pointer-events-none absolute"
              style={{
                top: g.pos,
                left: 0,
                right: 0,
                height: 0,
                borderTop: '1px dashed #ec4899',
                zIndex: 45,
              }}
            />
          ),
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
            {flowMode ? `Flow layout (${canvasW}px) - the same order adapts to mobile and PC.` : (
              <>
            Mobile layout ({canvasW}px) — a separate design from PC. Drag &amp;
            resize freely, or use "Auto-arrange" in the panel.
              </>
            )}
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
