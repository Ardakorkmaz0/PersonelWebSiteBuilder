// The wiring, not the rule — the rule itself is measured in htmlMotion.test.js
// and in a real browser. What has to hold here is that the edit document
// actually gets the treatment, and that View is left alone: View is where the
// page's own script runs, so resting it there would replace the animation with
// its ending.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
