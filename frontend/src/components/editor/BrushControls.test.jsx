import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import BrushControls from './BrushControls.jsx'

function renderBrush(overrides = {}) {
  localStorage.setItem('pwb_language', 'en')
  const props = {
    brushColor: '#2563eb',
    brushTarget: 'smart',
    recentColors: ['#123456'],
    onColor: vi.fn(),
    onTarget: vi.fn(),
    ...overrides,
  }
  const result = render(
    <LanguageProvider>
      <BrushControls {...props} />
    </LanguageProvider>,
  )
  return { ...result, props }
}

describe('BrushControls', () => {
  it('uses Studio theme surfaces instead of fixed light colors', () => {
    const { container } = renderBrush()
    expect(container.firstChild).toHaveClass('studio-toolbar')
    expect(screen.getByRole('button', { name: 'Smart' })).toHaveClass('bg-[var(--studio-accent)]')
    expect(screen.getByLabelText('Brush color').closest('label')).toHaveClass('bg-[var(--studio-control)]')
  })

  it('keeps target and color actions working', async () => {
    const user = userEvent.setup()
    const { props } = renderBrush()
    await user.click(screen.getByRole('button', { name: 'Fill' }))
    await user.click(screen.getByRole('button', { name: 'Use #111827' }))
    expect(props.onTarget).toHaveBeenCalledWith('fill')
    expect(props.onColor).toHaveBeenCalledWith('#111827')
  })
})
