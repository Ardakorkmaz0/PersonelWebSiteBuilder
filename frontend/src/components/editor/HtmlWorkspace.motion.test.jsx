// The wiring, not the rule — the rule itself is measured in htmlMotion.test.js
// and in a real browser. What has to hold here is that the edit document
// actually gets the treatment, and that View is left alone: View is where the
// page's own script runs, so resting it there would replace the animation with
// its ending.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import HtmlWorkspace from './HtmlWorkspace.jsx'
import { applyMotionRest } from '../../utils/htmlMotion.js'

vi.mock('../../utils/htmlMotion.js', async (importOriginal) => ({
  ...(await importOriginal()),
  applyMotionRest: vi.fn(() => 0),
  clearMotionRest: vi.fn(),
}))

const PAGE = '<html><head></head><body><section data-aos="fade-up">Hero</section></body></html>'

function mount(mode) {
  localStorage.setItem('pwb_language', 'en')
  localStorage.setItem('pwb_htmlmode_motion-test', mode)
  return render(
    <LanguageProvider>
      <HtmlWorkspace persistKey="motion-test" html={PAGE} deviceId="desktop-16-9" />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
})

describe('showing an unrun reveal in the editor', () => {
  it('rests the edit document as soon as it loads', () => {
    mount('edit')
    // jsdom fires no load event for srcdoc, so drive the same handler the
    // iframe does.
    screen.getByTitle('site').dispatchEvent(new Event('load'))

    expect(applyMotionRest).toHaveBeenCalled()
    expect(applyMotionRest.mock.calls[0][0]).toBe(screen.getByTitle('site').contentDocument)
  })

  it('leaves View alone — that is where the animation is supposed to play', () => {
    mount('view')
    screen.getByTitle('site').dispatchEvent(new Event('load'))

    expect(applyMotionRest).not.toHaveBeenCalled()
  })
})

// The reported problem: at a device wider than the editor area the page was
// scaled down to fit, so the size you set was never the size you saw, and
// there was no way to say "draw it bigger".
describe('how big the page is drawn', () => {
  function mountWorkspace() {
    localStorage.setItem('pwb_language', 'en')
    localStorage.setItem('pwb_htmlmode_zoom-test', 'edit')
    return render(
      <LanguageProvider>
        <HtmlWorkspace
          persistKey="zoom-test"
          html="<html><body><h1>Hi</h1></body></html>"
          deviceId="fhd"
          fullscreen={false}
          onToggleFullscreen={() => {}}
        />
      </LanguageProvider>,
    )
  }

  it('offers a zoom control on the edit canvas', () => {
    mountWorkspace()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument()
  })

  it('takes a chosen zoom instead of only ever fitting', async () => {
    // jsdom measures no layout, so the stage transform is not the thing to
    // assert on here — the arithmetic is covered in canvasZoom.test.js and the
    // scale is measured in a real browser. What this pins is that the control
    // is wired to the canvas at all: the readout stops saying "fit" and reports
    // the chosen number.
    const user = userEvent.setup()
    mountWorkspace()
    expect(localStorage.getItem('pwb_html_canvas_zoom')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))

    // The exact step depends on what fit measured, which jsdom cannot do. What
    // matters is that the canvas is no longer on fit and the readout agrees.
    const stored = localStorage.getItem('pwb_html_canvas_zoom')
    expect(stored).not.toBe('fit')
    expect(Number(stored)).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: new RegExp(`Zoom: ${stored}%`) })).toBeInTheDocument()
  })

  it('remembers the zoom across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = mountWorkspace()
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    const chosen = localStorage.getItem('pwb_html_canvas_zoom')
    unmount()

    mountWorkspace()

    expect(localStorage.getItem('pwb_html_canvas_zoom')).toBe(chosen)
    expect(chosen).not.toBe('fit')
  })

  it('hands the full-screen switch to the editor rather than acting alone', async () => {
    const user = userEvent.setup()
    const onToggleFullscreen = vi.fn()
    localStorage.setItem('pwb_language', 'en')
    localStorage.setItem('pwb_htmlmode_fs-test', 'edit')
    render(
      <LanguageProvider>
        <HtmlWorkspace persistKey="fs-test" html="<html><body><h1>Hi</h1></body></html>" deviceId="fhd" onToggleFullscreen={onToggleFullscreen} />
      </LanguageProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Full screen editing' }))

    // Only the editor knows about the rails, so the workspace must not try.
    expect(onToggleFullscreen).toHaveBeenCalled()
  })
})
