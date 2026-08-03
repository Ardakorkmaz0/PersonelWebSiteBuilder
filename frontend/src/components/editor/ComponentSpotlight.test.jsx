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
