// The control and the full-screen switch, from the outside: what the user
// clicks and what comes back.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import CanvasZoomControl from './CanvasZoomControl.jsx'
import useFullscreenEditing from './useFullscreenEditing.js'

function renderControl(props = {}) {
  localStorage.setItem('pwb_language', 'en')
  return render(
    <LanguageProvider>
      <CanvasZoomControl zoom="fit" fitScale={0.62} onZoom={vi.fn()} {...props} />
    </LanguageProvider>,
  )
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

describe('the zoom readout', () => {
  it('shows what fit actually landed on, not the word fit', () => {
    // 62% is the number that explains why the text looks small.
    renderControl()
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('shows the chosen zoom once one is picked', () => {
    renderControl({ zoom: 150 })
    expect(screen.getByText('150%')).toBeInTheDocument()
  })
})

describe('changing it', () => {
  it('steps up from where fit landed rather than jumping', async () => {
    const user = userEvent.setup()
    const onZoom = vi.fn()
    renderControl({ onZoom })

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))

    expect(onZoom).toHaveBeenCalledWith(67)
  })

  it('steps down the same way', async () => {
    const user = userEvent.setup()
    const onZoom = vi.fn()
    renderControl({ onZoom })

    await user.click(screen.getByRole('button', { name: 'Zoom out' }))

    expect(onZoom).toHaveBeenCalledWith(50)
  })

  it('returns to fit from the readout — the one value stepping cannot reach', async () => {
    const user = userEvent.setup()
    const onZoom = vi.fn()
    renderControl({ zoom: 150, fitScale: 0.62, onZoom })

    await user.click(screen.getByRole('button', { name: /Zoom: 150%/ }))

    expect(onZoom).toHaveBeenCalledWith('fit')
  })
})

describe('the full-screen switch', () => {
  it('is only offered when the editor can act on it', () => {
    renderControl()
    expect(screen.queryByRole('button', { name: 'Full screen editing' })).toBeNull()
  })

  it('says which way it goes', async () => {
    const user = userEvent.setup()
    const onToggleFullscreen = vi.fn()
    const { rerender } = renderControl({ onToggleFullscreen })

    await user.click(screen.getByRole('button', { name: 'Full screen editing' }))
    expect(onToggleFullscreen).toHaveBeenCalled()

    rerender(
      <LanguageProvider>
        <CanvasZoomControl zoom="fit" fitScale={1} onZoom={vi.fn()} fullscreen onToggleFullscreen={onToggleFullscreen} />
      </LanguageProvider>,
    )
    expect(screen.getByRole('button', { name: 'Leave full screen (Esc)' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('full-screen editing', () => {
  beforeEach(() => {
    document.documentElement.requestFullscreen = vi.fn(() => Promise.resolve())
    document.exitFullscreen = vi.fn(() => Promise.resolve())
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null, writable: true })
  })

  it('asks the browser for real full screen, not just a layout change', () => {
    const { result } = renderHook(() => useFullscreenEditing())

    act(() => result.current.toggleFullscreen())

    expect(result.current.fullscreen).toBe(true)
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
  })

  it('still hides the panels when the browser refuses', () => {
    // A refused request must not leave the button doing nothing at all.
    document.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')))
    const { result } = renderHook(() => useFullscreenEditing())

    act(() => result.current.toggleFullscreen())

    expect(result.current.fullscreen).toBe(true)
  })

  it('follows the browser out when it leaves full screen on its own', () => {
    const { result } = renderHook(() => useFullscreenEditing())
    act(() => result.current.toggleFullscreen())

    // Esc / F11 / the window chrome — none of them go through our button.
    act(() => { document.dispatchEvent(new Event('fullscreenchange')) })

    expect(result.current.fullscreen).toBe(false)
  })

  it('leaves on Escape even when there is no real full screen to exit', () => {
    document.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')))
    const { result } = renderHook(() => useFullscreenEditing())
    act(() => result.current.toggleFullscreen())

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })

    expect(result.current.fullscreen).toBe(false)
  })
})
