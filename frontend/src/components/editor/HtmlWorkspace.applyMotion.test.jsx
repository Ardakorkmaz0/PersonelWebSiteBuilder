// The wiring the Animation panel depends on: the panel calls the workspace, the
// workspace writes on the selected element, and the document that comes back
// carries it. If any link is missing the animation cannot play anywhere, which
// is exactly the shape of "it does nothing in Edit and nothing in View".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import HtmlWorkspace from './HtmlWorkspace.jsx'

const PAGE = '<html><head></head><body><h1 id="t">Hi</h1></body></html>'

function mountEditing(props = {}) {
  localStorage.setItem('pwb_language', 'en')
  localStorage.setItem('pwb_htmlmode_apply-test', 'edit')
  const ref = createRef()
  render(
    <LanguageProvider>
      <HtmlWorkspace ref={ref} persistKey="apply-test" html={PAGE} {...props} />
    </LanguageProvider>,
  )
  const iframe = screen.getByTitle('site')
  // jsdom fires no load for srcdoc; seed the document the way the real load does.
  iframe.contentDocument.body.innerHTML = '<h1 id="t">Hi</h1>'
  fireEvent.load(iframe)
  return { ref, iframe }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
})

describe('applying an animation to the selected element', () => {
  it('writes it on the element and commits a document that carries it', () => {
    const onCommit = vi.fn()
    const { ref, iframe } = mountEditing({ onCommit })

    fireEvent.click(iframe.contentDocument.getElementById('t'))
    act(() => ref.current.applyMotionToSelected({ animIn: 'fade-up', animSpeed: 'normal' }))

    expect(iframe.contentDocument.getElementById('t').getAttribute('data-anim-in')).toBe('fade-up')
    // The committed document is what View and the published page render.
    const committed = onCommit.mock.calls.at(-1)?.[0] || ''
    expect(committed).toContain('data-anim-in="fade-up"')
  })

  it('tells the panel what the element now carries, so it can say "in use"', () => {
    const onElementSelect = vi.fn()
    const { ref, iframe } = mountEditing({ onElementSelect })

    fireEvent.click(iframe.contentDocument.getElementById('t'))
    act(() => ref.current.applyMotionToSelected({ animIn: 'zoom', animSpeed: 'fast' }))

    expect(onElementSelect.mock.calls.at(-1)?.[0]?.motion).toEqual({
      animIn: 'zoom', animHover: 'none', animSpeed: 'fast',
    })
  })

  it('does nothing at all when no element is selected', () => {
    const onCommit = vi.fn()
    const { ref, iframe } = mountEditing({ onCommit })

    act(() => ref.current.applyMotionToSelected({ animIn: 'fade-up', animSpeed: 'normal' }))

    expect(iframe.contentDocument.getElementById('t').hasAttribute('data-anim-in')).toBe(false)
  })
})
