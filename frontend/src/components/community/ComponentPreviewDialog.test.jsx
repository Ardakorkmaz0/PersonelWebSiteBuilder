// The look you take before putting somebody else's markup on your own page.
// It has to be the real block, at real widths, with the decision reachable
// from where you made it.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import ComponentPreviewDialog from './ComponentPreviewDialog.jsx'

const COMPONENT = {
  id: 3,
  title: 'Pricing card',
  description: 'Three tiers',
  html: '<div class="card">Pro</div>',
  css: '.card { padding: 24px; }',
  author_display_name: 'Ada',
  use_count: 7,
  author_id: 9,
}

function renderPreview(props = {}) {
  localStorage.setItem('pwb_language', 'en')
  return render(
    <LanguageProvider>
      <ComponentPreviewDialog component={COMPONENT} onClose={vi.fn()} {...props} />
    </LanguageProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('the big preview', () => {
  it('renders the real block, scriptless and cross-origin', () => {
    renderPreview()
    const frame = screen.getByTitle('Preview block')
    expect(frame.getAttribute('srcdoc')).toContain('Pro')
    expect(frame.getAttribute('srcdoc')).toContain('padding: 24px')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin')
  })

  it('opens wide and narrows to the widths that actually break things', async () => {
    const user = userEvent.setup()
    renderPreview()
    const frame = screen.getByTitle('Preview block')
    expect(frame.style.width).toBe('1100px')

    await user.click(screen.getByRole('button', { name: 'Phone' }))

    // The frame itself narrows, so the block reflows the way it would in a
    // page that narrow — a scaled-down picture would prove nothing.
    expect(screen.getByTitle('Preview block').style.width).toBe('390px')
    expect(screen.getByText(/390px/)).toBeInTheDocument()
  })

  it('says whose it is and how far it has travelled', () => {
    renderPreview()
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Three tiers')).toBeInTheDocument()
    expect(screen.getByText('7 uses')).toBeInTheDocument()
  })
})

describe('deciding from here', () => {
  it('carries the choice straight through instead of sending you back', async () => {
    const user = userEvent.setup()
    const onUse = vi.fn()
    renderPreview({ onUse })

    await user.click(screen.getByRole('button', { name: 'Use this' }))

    expect(onUse).toHaveBeenCalledWith(COMPONENT)
  })

  it('offers the flag on a stranger’s block and not on your own', async () => {
    const { unmount } = renderPreview()
    expect(screen.getByRole('button', { name: 'Report this block' })).toBeInTheDocument()
    unmount()

    renderPreview({ mine: true })
    expect(screen.queryByRole('button', { name: 'Report this block' })).toBeNull()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPreview({ onClose })

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
