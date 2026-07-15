import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { describeElement } from '../../utils/htmlElementEdit.js'
import HtmlElementPanel from './HtmlElementPanel.jsx'

describe('HtmlElementPanel actions', () => {
  it('keeps common element actions in a fixed footer and exposes delete prominently', async () => {
    localStorage.setItem('pwb_language', 'en')
    document.body.innerHTML = '<section><p id="selected">Hello</p></section>'
    const onDelete = vi.fn()
    const user = userEvent.setup()

    render(
      <LanguageProvider>
        <HtmlElementPanel
          info={describeElement(document.getElementById('selected'))}
          onChange={vi.fn()}
          onSelectParent={vi.fn()}
          onDuplicate={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onDelete={onDelete}
          onClose={vi.fn()}
        />
      </LanguageProvider>,
    )

    const actions = screen.getByRole('region', { name: 'Arrange' })
    expect(actions).toHaveClass('shrink-0')
    expect(actions.previousElementSibling).toHaveClass('overflow-y-auto')
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move down' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete component' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
