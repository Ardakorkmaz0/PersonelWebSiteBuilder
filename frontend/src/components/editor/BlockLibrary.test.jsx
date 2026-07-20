import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import BlockLibrary from './BlockLibrary.jsx'

function renderLibrary(props = {}) {
  return render(
    <LanguageProvider>
      <BlockLibrary open onClose={() => {}} {...props} />
    </LanguageProvider>,
  )
}

describe('BlockLibrary', () => {
  it('renders nothing when closed', () => {
    localStorage.setItem('pwb_language', 'en')
    render(
      <LanguageProvider>
        <BlockLibrary open={false} onClose={() => {}} />
      </LanguageProvider>,
    )
    expect(document.querySelector('[data-block-library]')).toBeNull()
  })

  // The All view mounts the ENTIRE library (~140 cards, sections in iframes);
  // under a loaded parallel test run that render can exceed the default 5s.
  it('lists categories with counts and shows every entry under All blocks', { timeout: 20000 }, () => {
    localStorage.setItem('pwb_language', 'en')
    renderLibrary()
    expect(screen.getByText('Block library')).toBeInTheDocument()
    // Category rail: All blocks + Sections + one per palette type (desktop nav
    // + mobile chip row render each label twice; assert via the desktop nav).
    expect(screen.getAllByText('All blocks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sections').length).toBeGreaterThan(0)
    // A known section block card is present by default (All).
    expect(screen.getAllByText(/Hero/i).length).toBeGreaterThan(0)
  })

  it('search filters across every category and ignores the active one', async () => {
    localStorage.setItem('pwb_language', 'en')
    const user = userEvent.setup()
    renderLibrary()
    const input = screen.getByPlaceholderText('Search blocks')
    await user.type(input, 'zzz-no-such-block')
    expect(screen.getByText('No blocks match your search')).toBeInTheDocument()
  })

  it('clicking a card arms placement on the canvas and closes the overlay', async () => {
    localStorage.setItem('pwb_language', 'en')
    const user = userEvent.setup()
    const onArm = vi.fn()
    const onClose = vi.fn()
    renderLibrary({ onArmPlacement: onArm, onClose })
    const card = document.querySelector('[data-block-library] .grid button')
    await user.click(card)
    expect(onArm).toHaveBeenCalledTimes(1)
    const armed = onArm.mock.calls[0][0]
    expect(armed.w).toBeGreaterThan(0)
    expect(armed.h).toBeGreaterThan(0)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('in HTML mode a click inserts via onPickComponent instead', async () => {
    localStorage.setItem('pwb_language', 'en')
    const user = userEvent.setup()
    const onPick = vi.fn()
    const onArm = vi.fn()
    const onClose = vi.fn()
    renderLibrary({ onPickComponent: onPick, onArmPlacement: onArm, onClose })
    const card = document.querySelector('[data-block-library] .grid button')
    await user.click(card)
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onArm).not.toHaveBeenCalled()
    expect(typeof onPick.mock.calls[0][1]).toBe('string') // html payload
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
