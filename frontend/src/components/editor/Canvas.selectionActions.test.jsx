import { act, render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { beforeEach, describe, expect, it } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import Canvas from './Canvas.jsx'
import { selectionActionsPosition } from './canvasSelectionActionsLayout.js'

function loadSelectedPage() {
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{
      id: 'home',
      name: 'Home',
      canvasWidth: 1000,
      components: [{
        id: 'button',
        type: 'button',
        props: { text: 'Button' },
        styles: {},
        layout: { x: 450, y: 200, w: 100, h: 50 },
      }],
    }],
  })
  useEditorStore.getState().setViewport('pc')
  useEditorStore.getState().selectComponent('button')
}

function renderCanvas() {
  return render(
    <LanguageProvider>
      <DndContext>
        <Canvas />
      </DndContext>
    </LanguageProvider>,
  )
}

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

describe('canvas selection action overlay', () => {
  it('uses the selected node rectangle instead of a fixed canvas location', () => {
    loadSelectedPage()
    const { container } = renderCanvas()
    const canvas = container.querySelector('#free-canvas')
    const target = container.querySelector('[data-cid="button"]')
    const canvasRect = { left: 100, top: 50, width: 1000, height: 800, right: 1100, bottom: 850 }
    let targetRect = { left: 550, top: 250, width: 100, height: 50, right: 650, bottom: 300 }
    canvas.getBoundingClientRect = () => canvasRect
    target.getBoundingClientRect = () => targetRect

    const expectedPosition = () => selectionActionsPosition({
      canvasWidth: parseFloat(canvas.style.width),
      canvasHeight: parseFloat(canvas.style.minHeight),
      targetX: targetRect.left - canvasRect.left,
      targetY: targetRect.top - canvasRect.top,
      targetWidth: targetRect.width,
      targetHeight: targetRect.height,
      canvasScale: Number(canvas.dataset.builderCanvasScale),
    })

    act(() => window.dispatchEvent(new Event('resize')))

    const toolbar = container.querySelector('[data-canvas-selection-actions]')
    let expected = expectedPosition()
    expect(toolbar.style.left).toBe(`${expected.left}px`)
    expect(toolbar.style.top).toBe(`${expected.top}px`)
    expect(toolbar.style.zIndex).toBe('1100')

    // Move the selected node to the canvas top. The same measured-node path
    // flips the bar below it rather than leaving it clipped above the canvas.
    targetRect = { left: 120, top: 54, width: 100, height: 44, right: 220, bottom: 98 }
    act(() => window.dispatchEvent(new Event('resize')))

    expected = expectedPosition()
    expect(expected.placement).toBe('below')
    expect(toolbar.style.left).toBe(`${expected.left}px`)
    expect(toolbar.style.top).toBe(`${expected.top}px`)
  })
})
