// The selection chrome is one system with one rule: every length is authored
// in SCREEN pixels and divided by the scale the item is painted at. These tests
// pin that rule for the helpers and for all three item renderers, so the frame
// cannot drift back to "2px of design space" in one of them.
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { beforeEach, describe, expect, it } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import FreeCanvasItem from './FreeCanvasItem.jsx'
import FlowCanvasItem from './FlowCanvasItem.jsx'
import { chromeMetrics, frameOutsets, hoverRingStyle, resizeHandles } from './selectionChrome.js'

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

describe('chromeMetrics', () => {
  it('keeps the frame 2 screen px at any scale', () => {
    for (const scale of [0.25, 0.35, 1, 2, 4]) {
      expect(chromeMetrics(scale).frame * scale).toBeCloseTo(2)
      expect(chromeMetrics(scale).handle * scale).toBeCloseTo(12)
    }
  })

  it('treats a missing or broken scale as 1:1', () => {
    for (const scale of [undefined, 0, -1, NaN, 'x']) expect(chromeMetrics(scale).frame).toBe(2)
  })

  it('centres the handles on the element edge', () => {
    const m = chromeMetrics(1)
    const [, nw] = resizeHandles({ x: 100, y: 100, w: 50, h: 50 }, m)[0]
    expect(nw.top).toBe(-m.handle / 2)
    expect(nw.left).toBe(-m.handle / 2)
  })

  it('draws the frame and hover ring inside where the edge would clip them', () => {
    const m = chromeMetrics(1)
    const atEdge = frameOutsets({ x: 0, y: 40, w: 100, h: 40, maxW: 1000 }, m)
    expect(atEdge.left).toBe(0)
    expect(atEdge.top).toBe(-m.outset)
    expect(hoverRingStyle(m, atEdge)['--pwb-chrome-hover-shadow']).toMatch(/^inset /)
    const free = frameOutsets({ x: 50, y: 40, w: 100, h: 40, maxW: 1000, maxH: 1000 }, m)
    expect(hoverRingStyle(m, free)['--pwb-chrome-hover-shadow']).not.toMatch(/inset/)
  })
})

function loadPage(components, extra = {}) {
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{ id: 'p', name: 'Home', canvasWidth: 1000, ...extra, components }],
  })
  useEditorStore.getState().setViewport('pc')
}

function renderItem(node) {
  return render(
    <LanguageProvider>
      <DndContext>{node}</DndContext>
    </LanguageProvider>,
  )
}

const frameWidth = (container) => Number(container.querySelector('[data-selection-frame]').dataset.frameWidth)
const handleWidth = (container) => parseFloat(container.querySelector('[data-resize-handle]').style.width)

describe('every renderer draws the same physical frame', () => {
  it('free canvas item', () => {
    loadPage([{ id: 'a', type: 'button', props: {}, styles: {}, layout: { x: 100, y: 100, w: 100, h: 40 } }])
    useEditorStore.getState().selectComponent('a')
    const component = useEditorStore.getState().schema.pages[0].components[0]
    for (const scale of [0.5, 1, 4]) {
      const { container, unmount } = renderItem(<FreeCanvasItem component={component} canvasScale={scale} />)
      expect(frameWidth(container) * scale).toBeCloseTo(2)
      expect(handleWidth(container) * scale).toBeCloseTo(12)
      unmount()
    }
  })

  it('flow canvas item', () => {
    loadPage([{ id: 'a', type: 'text', props: { text: 'Hi' }, styles: {}, layout: { x: 0, y: 0, w: 300, h: 60 } }], { flowMode: true })
    useEditorStore.getState().selectComponent('a')
    const component = useEditorStore.getState().schema.pages[0].components[0]
    for (const scale of [0.5, 4]) {
      const { container, unmount } = renderItem(<FlowCanvasItem component={component} canvasWidth={1000} canvasScale={scale} />)
      expect(frameWidth(container) * scale).toBeCloseTo(2)
      expect(handleWidth(container) * scale).toBeCloseTo(12)
      unmount()
    }
  })

  it('a child inside a container, through the container scale', () => {
    loadPage([{
      id: 'box',
      type: 'container',
      props: {},
      styles: {},
      layout: { x: 0, y: 0, w: 600, h: 300 },
      children: [{ id: 'kid', type: 'button', props: {}, styles: {}, layout: { x: 40, y: 40, w: 100, h: 40 } }],
    }])
    useEditorStore.getState().selectComponent('kid')
    const component = useEditorStore.getState().schema.pages[0].components[0]
    const { container } = renderItem(<FreeCanvasItem component={component} canvasScale={2} />)
    const kid = container.querySelector('[data-cid="kid"]')
    // jsdom has no layout, so the container's own fit-down is 1: the child is
    // painted at the canvas scale.
    expect(Number(kid.querySelector('[data-selection-frame]').dataset.frameWidth) * 2).toBeCloseTo(2)
  })
})
