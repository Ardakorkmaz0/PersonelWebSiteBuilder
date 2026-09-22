// Where the page puts you back.
//
// One saved offset per URL was not enough for the Explore feed, which filters
// by category without changing the path. Every category shared one number, so
// returning to a filtered feed used the unfiltered feed's position — and worse,
// switching filters overwrote the real position with whatever the browser had
// clamped the scroll to while the shorter list rendered.
import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetScroll, useScrollRestore } from './useScrollRestore.js'

function Probe({ ready = true, scope = '' }) {
  useScrollRestore(ready, scope)
  return null
}

function mount(props, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe {...props} />
    </MemoryRouter>,
  )
}

function scrollTo(y) {
  window.scrollY = y
  act(() => { window.dispatchEvent(new Event('scroll')) })
}

describe('scroll restoration', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.scrollY = 0
    window.scrollTo = vi.fn((x, y) => { window.scrollY = typeof x === 'object' ? x.top : y })
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('remembers where you were', () => {
    mount({})

    scrollTo(820)

    expect(sessionStorage.getItem('pwb-scroll:/')).toBe('820')
  })

  it('puts you back there on the way in', () => {
    sessionStorage.setItem('pwb-scroll:/', '640')

    mount({})

    expect(window.scrollTo).toHaveBeenCalledWith(0, 640)
  })

  it('waits for the content that gives the page its height', () => {
    // Restoring into a page that has not rendered its list yet just gets
    // clamped to the bottom of a short document.
    sessionStorage.setItem('pwb-scroll:/', '640')

    mount({ ready: false })

    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('keeps a separate position per scope', () => {
    const all = mount({ scope: '' })
    scrollTo(1400)
    all.unmount()

    const portfolio = mount({ scope: 'portfolio' })
    scrollTo(300)
    portfolio.unmount()

    expect(sessionStorage.getItem('pwb-scroll:/')).toBe('1400')
    expect(sessionStorage.getItem('pwb-scroll:/|portfolio')).toBe('300')
  })

  it('does not restore one scope into another', () => {
    sessionStorage.setItem('pwb-scroll:/', '1400')

    mount({ scope: 'portfolio' })

    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('does not overwrite the real position on the way out', () => {
    // The bug this replaced: unmount saved the CURRENT offset, and when a
    // filter shrank the page the browser had already scrolled up on its own.
    // The clamped number then buried where the person actually was.
    const view = mount({})
    scrollTo(1400)

    window.scrollY = 724 // the browser clamping a now-shorter page
    view.unmount()

    expect(sessionStorage.getItem('pwb-scroll:/')).toBe('1400')
  })

  it('forgets a position on request', () => {
    sessionStorage.setItem('pwb-scroll:/|portfolio', '300')

    forgetScroll('/', 'portfolio')

    expect(sessionStorage.getItem('pwb-scroll:/|portfolio')).toBe(null)
  })

  it('keys by path as well as scope', () => {
    mount({}, '/favorites')

    scrollTo(210)

    expect(sessionStorage.getItem('pwb-scroll:/favorites')).toBe('210')
    expect(sessionStorage.getItem('pwb-scroll:/')).toBe(null)
  })
})
