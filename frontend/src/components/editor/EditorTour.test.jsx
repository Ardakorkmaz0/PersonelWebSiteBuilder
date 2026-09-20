// The walkthrough shows itself once and then gets out of the way: it can be
// left from the ×, from Escape, or by clicking away, and it never points at a
// panel this workspace does not have.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import EditorTour from './EditorTour.jsx'
import { EDITOR_TOUR_KEY, tourWasSeen } from '../../utils/editorTour.js'

const STEPS = [
  { id: 'rail', target: '[data-tour="rail-left"]', title: 'Pages and blocks', body: 'Your pages live here.' },
  { id: 'gone', target: '[data-tour="not-here"]', title: 'Missing', body: 'Nothing to point at.' },
  { id: 'publish', target: '[data-tour="publish"]', title: 'Save and publish', body: 'Save keeps your work.' },
]

function anchor(name) {
  const element = document.createElement('div')
  element.setAttribute('data-tour', name)
  document.body.append(element)
  return element
}

function renderTour(props = {}) {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <EditorTour open steps={STEPS} onClose={() => {}} {...props} />
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

describe('EditorTour', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('pwb_language', 'en')
    document.body.innerHTML = ''
    anchor('rail-left')
    anchor('publish')
  })

  it('walks forward and back through the steps that exist here', async () => {
    renderTour()

    // The step whose target is missing is not part of the tour at all.
    expect(await screen.findByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('Pages and blocks')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(screen.getByText('Save and publish')).toBeInTheDocument()
    expect(screen.queryByText('Missing')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(screen.getByText('Pages and blocks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled()
  })

  it('moves with the arrow keys as well', async () => {
    renderTour()
    await screen.findByText('1/2')
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(screen.getByText('2/2')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it.each([
    ['the ×', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Skip', () => fireEvent.click(screen.getByRole('button', { name: 'Skip' }))],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['a click outside', () => fireEvent.click(document.querySelector('.editor-tour-dim'))],
  ])('closes from %s, and remembers that it was seen', async (_label, leave) => {
    const onClose = vi.fn()
    renderTour({ onClose })
    await screen.findByText('1/2')

    leave()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(tourWasSeen()).toBe(true)
    expect(localStorage.getItem(EDITOR_TOUR_KEY)).toBe('1')
  })

  it('finishes on the last step', async () => {
    const onClose = vi.fn()
    renderTour({ onClose })
    await screen.findByText('1/2')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(tourWasSeen()).toBe(true)
  })

  it('renders nothing when it is closed, or when no step has a target', async () => {
    const { container } = renderTour({ open: false })
    await new Promise((resolve) => window.setTimeout(resolve, 20))
    expect(container.querySelector('.editor-tour')).toBeNull()

    document.body.innerHTML = ''
    renderTour()
    await new Promise((resolve) => window.setTimeout(resolve, 20))
    expect(document.querySelector('.editor-tour')).toBeNull()
  })
})
