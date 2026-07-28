import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { describeElement } from '../../utils/htmlElementEdit.js'
import HtmlElementPanel from './HtmlElementPanel.jsx'

function renderPanel(overrides = {}) {
  localStorage.clear()
  localStorage.setItem('pwb_language', 'en')
  document.body.innerHTML = '<section><p id="selected">Hello</p></section>'
  const props = {
    onChange: vi.fn(),
    onSelectParent: vi.fn(),
    onDuplicate: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onDelete: vi.fn(),
    onResetMobile: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
    info: {
      ...describeElement(document.getElementById('selected')),
      ...(overrides.info || {}),
    },
  }
  render(
    <LanguageProvider>
      <HtmlElementPanel {...props} />
    </LanguageProvider>,
  )
  return props
}

describe('HtmlElementPanel', () => {
  it('uses the same compact action footer as canvas properties', async () => {
    const props = renderPanel()
    const user = userEvent.setup()

    const actions = screen.getByRole('region', { name: 'Arrange' })
    expect(actions).toHaveClass('shrink-0')
    expect(actions.previousElementSibling).toHaveClass('overflow-y-auto')
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.getByRole('button', { name: 'Move up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move down' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete component' }))
    expect(props.onDelete).toHaveBeenCalledOnce()
  })

  it('keeps every advanced field reachable through Content, Design and Layout tabs', async () => {
    renderPanel()
    const user = userEvent.setup()

    expect(screen.getByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Basic')).not.toBeInTheDocument()
    expect(screen.queryByText('Extend')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Design' }))
    expect(screen.getByRole('button', { name: 'Typography' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Border' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Effects' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Layout' }))
    expect(screen.getByRole('button', { name: 'Align' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Size & spacing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Layout (rows / flex)' })).toBeInTheDocument()
  })

  it('shows and resets mobile-only element overrides', async () => {
    const props = renderPanel({
      viewport: 'mobile',
      info: { mobileOverrideCount: 2 },
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Design' }))
    expect(screen.getByText(/apply to MOBILE only/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Reset mobile styles/ }))
    expect(props.onResetMobile).toHaveBeenCalledOnce()
  })
})
