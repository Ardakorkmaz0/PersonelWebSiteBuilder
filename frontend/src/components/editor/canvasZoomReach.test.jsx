// Zooming a canvas past its fit has to leave the whole design reachable, and
// the zoom control has to actually zoom. Both edit canvases failed one of
// those: the component canvas clipped anything past the workspace edge with no
// scrollbar, and the HTML canvas on its default "Responsive" device ignored the
// zoom entirely while the readout kept changing.
import { fireEvent, render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { beforeEach, describe, expect, it } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import Canvas from './Canvas.jsx'
import HtmlWorkspace from './HtmlWorkspace.jsx'

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

function loadPage(viewport = 'pc') {
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{
      id: 'home',
      name: 'Home',
      canvasWidth: 1000,
      components: [{ id: 'b', type: 'button', props: {}, styles: {}, layout: { x: 40, y: 40, w: 120, h: 44 } }],
    }],
  })
  useEditorStore.getState().setViewport(viewport)
}

function renderCanvas(zoom) {
  return render(
    <LanguageProvider>
      <DndContext>
        <Canvas zoom={zoom} />
      </DndContext>
    </LanguageProvider>,
  )
}

describe('component canvas when zoomed past fit', () => {
  it.each(['pc', 'mobile'])('%s: the workspace scrolls both ways', (viewport) => {
    loadPage(viewport)
    const { container } = renderCanvas(200)
    const workspace = container.querySelector('main')
    expect(workspace.className).toContain('overflow-auto')
    expect(workspace.className).not.toContain('overflow-hidden')
    expect(workspace.className).not.toContain('overflow-x-hidden')
  })

  it('keeps the old clipping on fit, where nothing overflows', () => {
    loadPage('pc')
    const { container } = renderCanvas('fit')
    expect(container.querySelector('main').className).toContain('overflow-x-hidden')
  })
})

describe('component canvas pointer buttons', () => {
  it('a right- or middle-click on the canvas keeps the selection', () => {
    loadPage('pc')
    useEditorStore.getState().selectComponent('b')
    const { container } = renderCanvas('fit')
    const canvas = container.querySelector('#free-canvas')
    fireEvent.pointerDown(canvas, { button: 2 })
    fireEvent.pointerDown(canvas, { button: 1 })
    expect(useEditorStore.getState().selectedId).toBe('b')
    // A plain left click on the bare canvas still deselects.
    fireEvent.pointerDown(canvas, { button: 0 })
    fireEvent.pointerUp(window, { button: 0 })
    expect(useEditorStore.getState().selectedId).toBe(null)
  })
})

describe('HTML canvas on the Responsive device', () => {
  function renderWorkspace(zoom) {
    localStorage.setItem('pwb_htmlmode_zoom-test', 'edit')
    if (zoom === 'fit') localStorage.removeItem('pwb_html_canvas_zoom')
    else localStorage.setItem('pwb_html_canvas_zoom', String(zoom))
    return render(
      <LanguageProvider>
        <HtmlWorkspace
          persistKey="zoom-test"
          html="<html><body><main>Page</main></body></html>"
          deviceId="fit"
        />
      </LanguageProvider>,
    )
  }

  const scaledBox = () => screen.getByTitle('site').closest('[style*="scale("]')

  it('fills the stage without scaling on fit', () => {
    renderWorkspace('fit')
    expect(scaledBox()).toBeNull()
  })

  it('draws the page at the chosen zoom, in a stage that scrolls', () => {
    renderWorkspace(200)
    expect(scaledBox()?.style.transform).toBe('scale(2)')
    const stage = scaledBox().closest('main')
    expect(stage.className).toContain('overflow-auto')
  })
})
