// The mobile edit canvas is a DEVICE, not a strip of paper.
//
// It used to grow the phone body to the height of the design, so a long page
// produced a 4000px-tall iPhone: the frame stopped saying anything about what
// fits on a screen, and Edit disagreed with both View and HTML mode. The screen
// is now the size of the screen the user picked and the design scrolls inside
// it — which is also what gives pinned bars and drag auto-scroll a real
// "visible band" to work against.
import { describe, expect, it, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import Canvas from './Canvas.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import { mobileBrowserChromeH } from './browserFrameMetrics.js'
import { phoneModel, phoneScreenHeight } from './phoneFrameMetrics.js'
import { CANVAS_SCROLLER_ID } from '../../utils/dragAutoScroll.js'

// Loading a schema auto-arranges the mobile breakpoint, so the way to get a
// design taller than the screen is to give it enough blocks to stack — which is
// how a real page gets tall too.
const BLOCKS = 40

function loadPage({ mobileWidth = 393, mobileFold = 852, blocks = BLOCKS } = {}) {
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{
      id: 'page_home',
      name: 'Home',
      background: '#ffffff',
      mobileWidth,
      mobileFold,
      components: Array.from({ length: blocks }, (_, i) => ({
        id: `text_${i}`,
        type: 'text',
        props: { text: `Block ${i}` },
        styles: {},
        layout: { x: 20, y: 20 + i * 80, w: 200, h: 60 },
      })),
    }],
  })
  useEditorStore.getState().setViewport('mobile')
}

function renderCanvas(props = {}) {
  return render(
    <LanguageProvider>
      <DndContext>
        <Canvas {...props} />
      </DndContext>
    </LanguageProvider>,
  )
}

const phoneScreen = (container) => {
  const frame = container.querySelector('[data-builder-phone-frame]')
  return [...frame.children].find((el) => el.style.overflow === 'hidden')
}
const deviceViewport = (container) => container.querySelector(`#${CANVAS_SCROLLER_ID}`)

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

describe('mobile edit canvas', () => {
  it('keeps the phone at the chosen screen size, however long the design is', () => {
    loadPage()
    const { container } = renderCanvas()

    expect(phoneScreen(container).style.height).toBe('852px')
    const viewport = deviceViewport(container)
    expect(viewport).not.toBeNull()
    expect(viewport.style.height).toBe('852px')
    expect(viewport.style.width).toBe('393px')
  })

  it('scrolls the design inside that screen instead of stretching it', () => {
    loadPage()
    const { container } = renderCanvas()

    const artboard = container.querySelector('#free-canvas')
    // The artboard is as tall as the design, and it lives inside a shorter box:
    // that difference is what there is to scroll.
    const design = parseInt(artboard.style.minHeight, 10)
    const screen = parseInt(deviceViewport(container).style.height, 10)
    expect(screen).toBe(852)
    expect(design).toBeGreaterThan(screen)
    expect(deviceViewport(container).className).toContain('overflow-y-auto')
  })

  it('is the element the pin and auto-scroll helpers look up', () => {
    loadPage()
    const { container } = renderCanvas()
    // Exactly one canvas scroller, and it is the phone screen — not the editor
    // window, which is what those helpers used to measure on mobile.
    expect(document.querySelectorAll(`#${CANVAS_SCROLLER_ID}`)).toHaveLength(1)
    expect(deviceViewport(container).dataset.builderDeviceViewport).toBe('852')
  })

  it('fills the screen when the design is shorter than the device', () => {
    useEditorStore.getState().loadSchema({
      theme: {},
      pages: [{
        id: 'page_home',
        name: 'Home',
        background: '#ffffff',
        mobileWidth: 393,
        mobileFold: 852,
        components: [],
      }],
    })
    useEditorStore.getState().setViewport('mobile')
    const { container } = renderCanvas()
    expect(parseInt(container.querySelector('#free-canvas').style.minHeight, 10)).toBe(852)
  })

  it('falls back to the device height that goes with the width when no fold is set', () => {
    loadPage({ mobileWidth: 390, mobileFold: 0 })
    const { container } = renderCanvas()
    expect(phoneScreen(container).style.height).toBe(`${phoneScreenHeight(390)}px`)
    expect(phoneScreenHeight(390)).toBe(844)
  })

  it('hands the browser chrome its pixels out of the screen, not on top of it', () => {
    loadPage()
    const { container } = renderCanvas({ browserFrame: true })

    const chrome = mobileBrowserChromeH(phoneModel(393, 852))
    // The device is unchanged; the page gets what the browser leaves.
    expect(phoneScreen(container).style.height).toBe('852px')
    expect(deviceViewport(container).style.height).toBe(`${852 - chrome}px`)
    expect(container.querySelector('[data-builder-mobile-browser]')).not.toBeNull()
  })
})

describe('phoneScreenHeight', () => {
  it('knows every preset width', () => {
    expect(phoneScreenHeight(360)).toBe(780)
    expect(phoneScreenHeight(375)).toBe(667)
    expect(phoneScreenHeight(393)).toBe(852)
    expect(phoneScreenHeight(430)).toBe(932)
  })

  it('produces a plausible screen for a custom width', () => {
    expect(phoneScreenHeight(400)).toBe(864)
    expect(phoneScreenHeight(0)).toBe(842)
    expect(phoneScreenHeight(80)).toBe(480) // clamped, still holdable
  })
})
