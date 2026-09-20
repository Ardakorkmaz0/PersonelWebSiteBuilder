import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { useDialogMotion } from './useDialogMotion.js'

const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')

afterEach(() => {
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate)
  else delete Element.prototype.animate
  vi.restoreAllMocks()
})

function Harness({ onClose, disabled = false }) {
  const [origin, setOrigin] = useState(null)
  const [open, setOpen] = useState(false)
  const { backdropRef, dialogRef, onKeyDown, requestClose } = useDialogMotion({
    open, origin, disabled,
    onClose: () => { onClose(); setOpen(false) },
  })
  return <>
    <button onClick={(event) => {
      setOrigin({ left: 20, top: 20, width: 140, height: 40, trigger: event.currentTarget })
      setOpen(true)
    }}>Open</button>
    {open && <div ref={backdropRef}>
      <section role="dialog" tabIndex={-1} ref={dialogRef} onKeyDown={onKeyDown}>
        <input aria-label="Site title" autoFocus />
        <button onClick={requestClose}>Close</button>
      </section>
    </div>}
  </>
}

function reducedMotion(matches) {
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches }))
}

function installAnimations() {
  const animations = []
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(function (_frames, options) {
      let finish
      let reject
      const finished = new Promise((resolve, fail) => { finish = resolve; reject = fail })
      const animation = {
        element: this, options, finished, finish,
        cancel: vi.fn(() => reject(new DOMException('Cancelled', 'AbortError'))),
      }
      animations.push(animation)
      return animation
    }),
  })
  return animations
}

describe('dialog motion lifecycle', () => {
  it('dismisses without animation for reduced motion and restores trigger focus and body styles', () => {
    reducedMotion(true)
    const animations = installAnimations()
    const onClose = vi.fn()
    document.body.style.overflow = 'clip'
    document.body.style.paddingRight = '7px'
    render(<Harness onClose={onClose} />)

    fireEvent.click(screen.getByText('Open'))
    expect(document.body.style.overflow).toBe('hidden')
    expect(screen.getByLabelText('Site title')).toHaveFocus()
    fireEvent.keyDown(screen.getByLabelText('Site title'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
    expect(animations).toHaveLength(0)
    expect(screen.getByText('Open')).toHaveFocus()
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.paddingRight).toBe('7px')
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

  it('guards dismissal while creating and loops keyboard focus within the dialog', () => {
    reducedMotion(true)
    const onClose = vi.fn()
    const { rerender } = render(<Harness onClose={onClose} disabled />)
    fireEvent.click(screen.getByText('Open'))
    const input = screen.getByLabelText('Site title')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Close')).toHaveFocus()
    fireEvent.keyDown(screen.getByText('Close'), { key: 'Tab' })
    expect(input).toHaveFocus()

    rerender(<Harness onClose={onClose} />)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('waits for exit to finish, ignores repeated close, and cancels the entry animation', async () => {
    reducedMotion(false)
    const animations = installAnimations()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Close'))
    fireEvent.click(screen.getByText('Close'))

    expect(animations).toHaveLength(4)
    expect(animations[0].cancel).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    const exit = animations.find((animation) => animation.element.getAttribute('role') === 'dialog' && animation.options.duration === 200)
    await act(async () => exit.finish())

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Open')).toHaveFocus()
  })

  it('never fires a delayed dismissal after unmounting during exit', async () => {
    reducedMotion(false)
    const animations = installAnimations()
    const onClose = vi.fn()
    const { unmount } = render(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Close'))
    const exit = animations.find((animation) => animation.element.getAttribute('role') === 'dialog' && animation.options.duration === 200)

    unmount()
    await act(async () => exit.finish())

    expect(exit.cancel).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes immediately when Web Animations are unavailable', () => {
    reducedMotion(false)
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
