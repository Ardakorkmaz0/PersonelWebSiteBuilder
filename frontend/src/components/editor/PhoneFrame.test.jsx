// The phone screen has to be a REAL viewport, not just a minimum.
//
// Children fill it with `height: 100%`, and a percentage height only resolves
// against a parent whose height is definite. With `min-height` alone it is not:
// the HTML preview's iframe fell back to a replaced element's default 150px, so
// a page showed its first ~150px and the rest of the phone was the screen div's
// white background. It looked like the document was broken — in View and Edit,
// on every device, for every document — and nothing in the page was wrong.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PhoneFrame from './PhoneFrame.jsx'

const SCREEN_W = 393
const SCREEN_H = 852

function screenOf(container) {
  // The frame is the outer element; its screen is the child that clips.
  const frame = container.querySelector('[data-builder-phone-frame]')
  return [...frame.children].find((el) => el.style.overflow === 'hidden')
}

describe('PhoneFrame screen', () => {
  it('gives the screen a definite height, so percentage children can resolve', () => {
    const { container } = render(
      <PhoneFrame screenWidth={SCREEN_W} screenHeight={SCREEN_H}>
        <div data-testid="child" style={{ width: '100%', height: '100%' }} />
      </PhoneFrame>,
    )
    const screen = screenOf(container)
    expect(screen.style.height, 'height must be set, not only min-height').toBe(`${SCREEN_H}px`)
    expect(screen.style.width).toBe(`${SCREEN_W}px`)
  })

  it('keeps the minimum too, so the box never collapses below the device', () => {
    const { container } = render(
      <PhoneFrame screenWidth={SCREEN_W} screenHeight={SCREEN_H}>
        <span />
      </PhoneFrame>,
    )
    expect(screenOf(container).style.minHeight).toBe(`${SCREEN_H}px`)
  })

  it('sizes the outer body from the screen plus the bezel', () => {
    const { container } = render(
      <PhoneFrame screenWidth={SCREEN_W} screenHeight={SCREEN_H}>
        <span />
      </PhoneFrame>,
    )
    const frame = container.querySelector('[data-builder-phone-frame]')
    // Bezel is symmetric horizontally, so the body is wider than the screen.
    expect(parseInt(frame.style.width, 10)).toBeGreaterThan(SCREEN_W)
    expect(frame.style.paddingTop).toBeTruthy()
    expect(frame.style.paddingBottom).toBeTruthy()
  })

  it('renders whatever the caller puts on the screen', () => {
    const { getByTestId } = render(
      <PhoneFrame screenWidth={SCREEN_W} screenHeight={SCREEN_H}>
        <iframe data-testid="preview" title="preview" style={{ width: '100%', height: '100%' }} />
      </PhoneFrame>,
    )
    expect(getByTestId('preview')).toBeTruthy()
  })
})
