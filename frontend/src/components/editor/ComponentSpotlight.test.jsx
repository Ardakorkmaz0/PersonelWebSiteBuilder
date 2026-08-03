// The canvas spotlight shows ONE component at a real size. The things worth
// pinning are the ones that would quietly make it useless: showing the wrong
// component, showing it at its canvas position instead of on its own, showing
// nothing at all because it happens to be hidden on this breakpoint, or
// growing a second properties panel that drifts from the rail's.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import ComponentSpotlight from './ComponentSpotlight.jsx'
import CanvasSelectionActions from './CanvasSelectionActions.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import { CANVAS_SELECTION_Z, SPOTLIGHT_Z, toggleSpotlightTarget } from './spotlight.js'

function loadPage() {
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{
      id: 'page_home',
      name: 'Home',
      background: '#faf7f2',
      canvasWidth: 1920,
      components: [
        {
          id: 'card_1',
          type: 'card',
          props: { title: 'Selected work', text: 'A short description.' },
          styles: {},
          // Far from the origin on purpose.
          layout: { x: 1400, y: 900, w: 320, h: 220 },
        },
        {
          id: 'card_2',
          type: 'card',
          props: { title: 'Another card', text: 'Not this one.' },
          styles: {},
          layout: { x: 40, y: 40, w: 320, h: 220 },
        },
      ],
    }],
  })
  useEditorStore.getState().setViewport('pc')
}

function renderSpotlight(props = {}) {
  localStorage.setItem('pwb_language', 'en')
  return render(
    <LanguageProvider>
      <ComponentSpotlight open componentId="card_1" onClose={vi.fn()} {...props} />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  loadPage()
})

describe('ComponentSpotlight', () => {
  it('shows the component it was asked for, and only that one', () => {
    renderSpotlight()
    expect(screen.getByText('Selected work')).toBeInTheDocument()
    expect(screen.queryByText('Another card')).not.toBeInTheDocument()
  })

  it('draws it on its own rather than where it sits on the canvas', () => {
    const { container } = renderSpotlight()
    // The rendered box carries the component's size, at the origin — this is a
    // look at the component, not at its position.
    const box = [...container.querySelectorAll('div')].find(
      (el) => el.style.width === '320px' && el.style.height === '220px',
    )
    expect(box, 'the component should render at its own size').toBeTruthy()
    expect(box.style.left).toBe('0px')
    expect(box.style.top).toBe('0px')
  })

  it('shows a component that is hidden on this breakpoint', () => {
    // An empty spotlight reads as a bug rather than as a setting.
    useEditorStore.getState().setVisibility('card_1', { hidden: true })
    renderSpotlight()
    expect(screen.getByText('Selected work')).toBeInTheDocument()
  })

  it('renders nothing when closed or pointed at a component that is gone', () => {
    const { container: closed } = render(
      <LanguageProvider><ComponentSpotlight open={false} componentId="card_1" /></LanguageProvider>,
    )
    expect(closed.querySelector('[role="dialog"]')).toBeNull()

    const { container: missing } = render(
      <LanguageProvider><ComponentSpotlight open componentId="ghost_9" /></LanguageProvider>,
    )
    expect(missing.querySelector('[role="dialog"]')).toBeNull()
  })

  it('names the component by its type and offers the three widths', () => {
    renderSpotlight()
    expect(screen.getByText('Card')).toBeInTheDocument()
    for (const label of ['Desktop', 'Tablet', 'Phone']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('opens on the phone width while the phone breakpoint is being edited', () => {
    useEditorStore.getState().setViewport('mobile')
    renderSpotlight()
    expect(screen.getByRole('button', { name: /Phone/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Desktop/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('closes on Escape and on the backdrop', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSpotlight({ onClose })

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getAllByRole('button', { name: 'Close' })[0])
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('the canvas selection toolbar', () => {
  it('offers "open large" and hands back the component id', async () => {
    localStorage.setItem('pwb_language', 'en')
    const user = userEvent.setup()
    const onSpotlight = vi.fn()
    render(
      <LanguageProvider>
        <CanvasSelectionActions componentId="card_1" onSpotlight={onSpotlight} />
      </LanguageProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open large' }))
    expect(onSpotlight).toHaveBeenCalledWith('card_1')
  })

  it('leaves the action out when there is nowhere to open it', () => {
    localStorage.setItem('pwb_language', 'en')
    render(
      <LanguageProvider>
        <CanvasSelectionActions componentId="card_1" />
      </LanguageProvider>,
    )
    expect(screen.queryByRole('button', { name: 'Open large' })).toBeNull()
  })
})

// Two things the first version got wrong, both visible the moment it opened.
describe('the spotlight is actually on top, and the button toggles it', () => {
  it('clears the canvas selection chrome it would otherwise sit under', () => {
    // The floating selection toolbar rides at 1100 so it clears a lifted
    // component. The overlay opened at 200, so the blue frame and its buttons
    // painted straight over the blurred backdrop — and stayed clickable.
    expect(SPOTLIGHT_Z).toBeGreaterThan(CANVAS_SELECTION_Z)

    const { container } = renderSpotlight()
    const dialog = container.querySelector('[role="dialog"]')
    expect(Number(dialog.style.zIndex)).toBe(SPOTLIGHT_Z)
    expect(Number(dialog.style.zIndex)).toBeGreaterThan(CANVAS_SELECTION_Z)
  })

  it('covers the workspace with a backdrop that takes the clicks', () => {
    const { container } = renderSpotlight()
    const backdrop = container.querySelector('[role="dialog"] > button')
    expect(backdrop.className).toContain('inset-0')
    expect(backdrop.className).toContain('backdrop-blur')
  })
})

describe('toggleSpotlightTarget', () => {
  // Pressing "open large" again is how you leave — without hunting for the ×
  // or having to know that Escape works.
  it('closes when the same thing is pressed twice', () => {
    expect(toggleSpotlightTarget('card_1', 'card_1')).toBeNull()
  })

  it('switches straight to another one rather than closing first', () => {
    expect(toggleSpotlightTarget('card_1', 'card_2')).toBe('card_2')
  })

  it('opens from nothing', () => {
    expect(toggleSpotlightTarget(null, 'card_1')).toBe('card_1')
  })

  it('works on DOM elements too, which is what HTML mode passes', () => {
    const a = document.createElement('nav')
    const b = document.createElement('header')
    expect(toggleSpotlightTarget(a, a)).toBeNull()
    expect(toggleSpotlightTarget(a, b)).toBe(b)
  })

  it('stays closed when handed nothing', () => {
    expect(toggleSpotlightTarget('card_1', null)).toBeNull()
    expect(toggleSpotlightTarget(null, undefined)).toBeNull()
  })
})
