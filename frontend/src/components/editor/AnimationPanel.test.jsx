// The reported bug, pinned: in HTML mode an element was plainly selected on the
// canvas and the panel still said "select an element" with Use greyed out. It
// only ever knew about schema components, so in an HTML site — where there are
// none — it could never be anything but dead.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import AnimationPanel from './AnimationPanel.jsx'
import { useEditorStore } from '../../store/editorStore.js'

const SELECTED_ELEMENT = {
  tag: 'h1',
  motion: { animIn: 'none', animHover: 'none', animSpeed: 'normal' },
}

function renderPanel(props = {}) {
  localStorage.setItem('pwb_language', 'en')
  localStorage.setItem('pwb_last_anim', 'fade-up')
  return render(
    <LanguageProvider>
      <AnimationPanel {...props} />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useEditorStore.setState({ selectedId: null })
})

describe('HTML mode, with an element selected', () => {
  it('offers the button instead of asking for a selection it already has', () => {
    renderPanel({ html: { info: SELECTED_ELEMENT, onApply: vi.fn() } })

    expect(screen.getByRole('button', { name: 'Use this animation' })).toBeEnabled()
    expect(screen.queryByText('Select an element on the canvas to apply it.')).toBeNull()
  })

  it('applies the picked entrance to that element', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    renderPanel({ html: { info: SELECTED_ELEMENT, onApply } })

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    await user.click(screen.getByRole('button', { name: 'Use this animation' }))

    expect(onApply).toHaveBeenCalledWith({ animIn: 'zoom', animSpeed: 'normal' })
  })

  it('applies a hover effect too, and takes it back off', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const { rerender } = renderPanel({ html: { info: SELECTED_ELEMENT, onApply } })

    await user.click(screen.getByRole('button', { name: /Lift/ }))
    expect(onApply).toHaveBeenLastCalledWith({ animHover: 'lift' })

    // With it in use, the same swatch removes it.
    rerender(
      <LanguageProvider>
        <AnimationPanel html={{ info: { ...SELECTED_ELEMENT, motion: { ...SELECTED_ELEMENT.motion, animHover: 'lift' } }, onApply }} />
      </LanguageProvider>,
    )
    await user.click(screen.getByRole('button', { name: /Lift/ }))
    expect(onApply).toHaveBeenLastCalledWith({ animHover: 'none' })
  })

  it('says when the selected element already carries the pick', async () => {
    const user = userEvent.setup()
    renderPanel({
      html: { info: { ...SELECTED_ELEMENT, motion: { animIn: 'zoom', animHover: 'none', animSpeed: 'normal' } }, onApply: vi.fn() },
    })

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))

    expect(screen.getByRole('button', { name: 'In use' })).toBeInTheDocument()
  })

  it('does not claim the page is empty — an HTML page has no component schema', () => {
    renderPanel({ html: { info: SELECTED_ELEMENT, onApply: vi.fn() } })
    expect(screen.queryByText('This page is empty')).toBeNull()
    expect(screen.queryByText('This page')).toBeNull()
    // The neutral example still shows what the motion looks like.
    expect(screen.getByText('Example')).toBeInTheDocument()
  })
})

describe('HTML mode with nothing selected', () => {
  it('still asks for a selection — that message was never wrong, only misapplied', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    renderPanel({ html: { info: null, onApply } })

    await user.click(screen.getByRole('button', { name: 'Fade in' }))

    expect(screen.getByRole('button', { name: 'Use this animation' })).toBeDisabled()
    expect(screen.getByText('Select an element on the canvas to apply it.')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
  })
})

describe('the component canvas is untouched', () => {
  it('still writes through the store when there is no HTML selection to act on', async () => {
    const user = userEvent.setup()
    const updateProps = vi.fn()
    useEditorStore.setState({
      selectedId: 'c1',
      updateProps,
      schema: {
        theme: {},
        pages: [{ id: 'p1', name: 'Home', components: [{ id: 'c1', type: 'text', props: {} }] }],
      },
      currentPageId: 'p1',
    })
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Blur in' }))
    await user.click(screen.getByRole('button', { name: 'Use this animation' }))

    expect(updateProps).toHaveBeenCalledWith('c1', { animIn: 'blur', animSpeed: 'normal' })
  })
})

// An entrance could only ever be replaced by another entrance: nothing in the
// panel took an element back to still.
describe('taking the animation back off', () => {
  it('is not offered for an element that has none', () => {
    useEditorStore.setState({
      selectedId: 'c1',
      schema: { theme: {}, pages: [{ id: 'p1', name: 'Home', components: [{ id: 'c1', type: 'text', props: {} }] }] },
      currentPageId: 'p1',
    })
    renderPanel()

    expect(screen.queryByRole('button', { name: 'Remove animation' })).toBeNull()
  })

  it('clears the entrance and the hover of a component in one go', async () => {
    const user = userEvent.setup()
    const updateProps = vi.fn()
    useEditorStore.setState({
      selectedId: 'c1',
      updateProps,
      schema: {
        theme: {},
        pages: [{
          id: 'p1',
          name: 'Home',
          components: [{ id: 'c1', type: 'text', props: { animIn: 'fade-up', animHover: 'lift' } }],
        }],
      },
      currentPageId: 'p1',
    })
    renderPanel()

    expect(screen.getByText('Clears both the entrance and the hover effect on this element.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove animation' }))

    expect(updateProps).toHaveBeenCalledWith('c1', { animIn: 'none', animHover: 'none' })
  })

  it('clears an HTML element through the same apply channel', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    renderPanel({ html: { info: { tag: 'h1', motion: { animIn: 'fade-up', animHover: 'none', animSpeed: 'normal' } }, onApply } })

    expect(screen.getByText('Clears the entrance on this element.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove animation' }))

    expect(onApply).toHaveBeenCalledWith({ animIn: 'none', animHover: 'none' })
  })
})
