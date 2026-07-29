// Dragging inside a scrolling canvas — the "pull it up and it goes up" contract.
//
// The phone canvas is a fixed screen now, so the design scrolls INSIDE it. Drag
// math is pure pointer delta, which knows nothing about that scrolling: move the
// canvas 200px under a still pointer and the item is suddenly 200px away from
// the finger holding it, sliding the opposite way to the drag. These tests pin
// both halves — the direction, and the scroll compensation that keeps the item
// glued to the pointer.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import FreeCanvasItem from './FreeCanvasItem.jsx'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import {
  autoScrollStep,
  designScrollFactor,
  AUTO_SCROLL_STEP,
  CANVAS_SCROLLER_ID,
} from '../../utils/dragAutoScroll.js'

const ITEM = 'text_drag_1'

function layout() {
  return selectCurrentPage(useEditorStore.getState()).components[0].layout
}

function renderItem() {
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{
      id: 'page_home',
      name: 'Home',
      background: '#ffffff',
      components: [{
        id: ITEM,
        type: 'text',
        props: { text: 'Drag me' },
        styles: {},
        layout: { x: 40, y: 400, w: 200, h: 60 },
      }],
    }],
  })
  const component = selectCurrentPage(useEditorStore.getState()).components[0]
  const view = render(
    <LanguageProvider>
      <div id={CANVAS_SCROLLER_ID}>
        <div id="free-canvas" style={{ position: 'relative' }}>
          <FreeCanvasItem component={component} canvasScale={1} />
        </div>
      </div>
    </LanguageProvider>,
  )
  return {
    ...view,
    scroller: document.getElementById(CANVAS_SCROLLER_ID),
    handle: view.container.querySelector(`[data-cid="${ITEM}"]`),
  }
}

// The window listeners are what the drag actually binds to.
const move = (clientY, clientX = 100) =>
  fireEvent(window, new MouseEvent('pointermove', { clientX, clientY, bubbles: true }))
const release = () => fireEvent(window, new MouseEvent('pointerup', { bubbles: true }))

beforeEach(() => {
  useEditorStore.getState().selectComponent(null)
})

describe('dragging a component', () => {
  it('follows the pointer: up is up, down is down', () => {
    const { handle } = renderItem()
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 500 })

    move(380) // 120px up
    expect(layout().y).toBeLessThan(400)
    expect(layout().y).toBeCloseTo(280, -1)

    move(650) // and back down, past where it started
    expect(layout().y).toBeGreaterThan(400)
    expect(layout().y).toBeCloseTo(550, -1)
    release()
  })

  it('keeps the item under the pointer when the canvas scrolls beneath it', () => {
    const { handle, scroller } = renderItem()
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 500 })

    // The pointer has not moved; the canvas has. Without compensation the item
    // stays at y=400 and visually runs 200px away from the finger.
    scroller.scrollTop = 200
    move(500)
    expect(layout().y).toBeCloseTo(600, -1)

    // Scrolling back returns it, and a real pointer move still adds on top.
    scroller.scrollTop = 0
    move(460)
    expect(layout().y).toBeCloseTo(360, -1)
    release()
  })

  it('stops listening once the drag ends', () => {
    const { handle } = renderItem()
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 500 })
    move(300)
    const parked = layout().y
    release()

    move(900)
    expect(layout().y).toBe(parked)
  })
})

describe('autoScrollStep', () => {
  const rect = { top: 100, bottom: 900, height: 800 }

  it('scrolls down near the bottom edge and up near the top edge', () => {
    expect(autoScrollStep(rect, 880)).toBe(AUTO_SCROLL_STEP)
    expect(autoScrollStep(rect, 110)).toBe(-AUTO_SCROLL_STEP)
  })

  it('does nothing in the middle', () => {
    expect(autoScrollStep(rect, 500)).toBe(0)
  })

  it('refuses to act on a box too short to have two edges', () => {
    // Both edges would overlap, so every pointer position is "near" both.
    expect(autoScrollStep({ top: 0, bottom: 80, height: 80 }, 40)).toBe(0)
  })

  it('ignores a missing rect or a pointer that never reported a position', () => {
    expect(autoScrollStep(null, 10)).toBe(0)
    expect(autoScrollStep(rect, undefined)).toBe(0)
  })
})

describe('drag auto-scroll loop', () => {
  it('scrolls the canvas while the pointer rests at the edge, and re-applies', async () => {
    const { handle, scroller } = renderItem()
    // jsdom gives every element a zero rect; describe a real screen instead.
    scroller.getBoundingClientRect = () => ({ top: 100, bottom: 900, height: 800, left: 0, right: 400, width: 400 })
    Object.defineProperty(scroller, 'scrollHeight', { value: 4000, configurable: true })

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 500 })
    move(880) // park the pointer near the bottom edge
    const beforeScroll = scroller.scrollTop
    const beforeY = layout().y

    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(scroller.scrollTop).toBeGreaterThan(beforeScroll)
    // The item kept up with the canvas rather than being left behind.
    expect(layout().y).toBeGreaterThan(beforeY)
    release()

    // …and the loop stops with the drag: no further scrolling.
    const parked = scroller.scrollTop
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(scroller.scrollTop).toBe(parked)
  })

  it('leaves the canvas alone when the pointer is nowhere near an edge', async () => {
    const { handle, scroller } = renderItem()
    scroller.getBoundingClientRect = () => ({ top: 100, bottom: 900, height: 800, left: 0, right: 400, width: 400 })
    Object.defineProperty(scroller, 'scrollHeight', { value: 4000, configurable: true })

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 500 })
    move(500)
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(scroller.scrollTop).toBe(0)
    release()
  })
})

describe('a pinned bar', () => {
  it('does not take the scroll into its offsets — it is glued to the viewport', () => {
    useEditorStore.getState().loadSchema({
      theme: {},
      pages: [{
        id: 'page_home',
        name: 'Home',
        background: '#ffffff',
        components: [{
          id: 'navbar_1',
          type: 'navbar',
          props: { scrollBehavior: 'fixed', pinY: 'top', pinOffsetY: 0, links: [] },
          styles: {},
          layout: { x: 0, y: 0, w: 390, h: 64 },
        }],
      }],
    })
    const component = selectCurrentPage(useEditorStore.getState()).components[0]
    const view = render(
      <LanguageProvider>
        <div id={CANVAS_SCROLLER_ID}>
          <div id="free-canvas" style={{ position: 'relative' }}>
            <FreeCanvasItem component={component} canvasScale={1} />
          </div>
        </div>
      </LanguageProvider>,
    )
    const handle = view.container.querySelector('[data-cid="navbar_1"]')
    const scroller = document.getElementById(CANVAS_SCROLLER_ID)

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 200 })
    scroller.scrollTop = 300
    move(240) // 40px of real pointer movement, 300px of scrolling

    const props = selectCurrentPage(useEditorStore.getState()).components[0].props
    expect(props.pinOffsetY).toBe(40)
    release()
  })
})

describe('designScrollFactor', () => {
  // scrollTop is always in the scroller's own pixels, and the two canvases put
  // the scroller on opposite sides of the zoom. Getting this backwards moves a
  // dragged item by the zoom factor too far — or too little — on every scroll.
  const box = (layoutWidth, paintedWidth) => ({
    offsetWidth: layoutWidth,
    getBoundingClientRect: () => ({ width: paintedWidth }),
  })

  it('is 1 when the scroller is scaled together with the canvas (the phone)', () => {
    // Phone screen and artboard both painted at 70%: a scrolled pixel is a
    // design pixel.
    expect(designScrollFactor(box(393, 275.1), box(393, 275.1))).toBeCloseTo(1, 5)
  })

  it('undoes the zoom when only the canvas is scaled (the desktop workspace)', () => {
    // Workspace unscaled, artboard painted at 70%: one scrolled screen pixel is
    // 1/0.7 design pixels.
    expect(designScrollFactor(box(1200, 1200), box(1000, 700))).toBeCloseTo(1 / 0.7, 5)
  })

  it('falls back to 1 rather than guessing when nothing can be measured', () => {
    expect(designScrollFactor(null, null)).toBe(1)
    expect(designScrollFactor(box(0, 0), box(1000, 700))).toBe(1)
    expect(designScrollFactor({}, {})).toBe(1)
  })
})

describe('the canvas scroller id', () => {
  it('is the single name every drag and pin helper looks up', () => {
    expect(CANVAS_SCROLLER_ID).toBe('canvas-scroll')
    expect(vi.isMockFunction(autoScrollStep)).toBe(false)
  })
})
