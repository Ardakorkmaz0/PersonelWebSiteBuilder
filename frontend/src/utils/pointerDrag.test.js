import { describe, expect, it, vi } from 'vitest'
import { trackPointerDrag } from './pointerDrag.js'

function pointer(type, props = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 1, clientX: 0, clientY: 0, ...props })
  return event
}

describe('trackPointerDrag', () => {
  it('reports moves until pointerup, then stops listening', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    trackPointerDrag({ pointerId: 1 }, { onMove, onEnd })
    window.dispatchEvent(pointer('pointermove', { clientX: 5 }))
    window.dispatchEvent(pointer('pointerup'))
    window.dispatchEvent(pointer('pointermove', { clientX: 9 }))
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd.mock.calls[0][0].type).toBe('pointerup')
  })

  // The case that used to leave a drag glued to the finger: the browser took
  // the touch over and ended it with pointercancel, never pointerup.
  it('ends on pointercancel', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    trackPointerDrag({ pointerId: 1 }, { onMove, onEnd })
    window.dispatchEvent(pointer('pointercancel'))
    window.dispatchEvent(pointer('pointermove'))
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onMove).not.toHaveBeenCalled()
  })

  it('ends when the window loses focus mid-drag', () => {
    const onEnd = vi.fn()
    trackPointerDrag({ pointerId: 1 }, { onEnd })
    window.dispatchEvent(new Event('blur'))
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('ends exactly once, however many end signals arrive', () => {
    const onEnd = vi.fn()
    const stop = trackPointerDrag({ pointerId: 1 }, { onEnd })
    window.dispatchEvent(pointer('pointerup'))
    window.dispatchEvent(pointer('pointercancel'))
    stop()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('ignores a second finger', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    trackPointerDrag({ pointerId: 1 }, { onMove, onEnd })
    window.dispatchEvent(pointer('pointermove', { pointerId: 2 }))
    window.dispatchEvent(pointer('pointerup', { pointerId: 2 }))
    expect(onMove).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
    window.dispatchEvent(pointer('pointerup'))
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('captures the pointer so a release outside the window still arrives', () => {
    const target = document.createElement('div')
    target.setPointerCapture = vi.fn()
    target.hasPointerCapture = vi.fn(() => true)
    target.releasePointerCapture = vi.fn()
    const onEnd = vi.fn()
    trackPointerDrag({ pointerId: 7, currentTarget: target }, { onEnd })
    expect(target.setPointerCapture).toHaveBeenCalledWith(7)
    // Capture lost (element removed, or the browser released it) ends the drag.
    target.dispatchEvent(new Event('lostpointercapture'))
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
