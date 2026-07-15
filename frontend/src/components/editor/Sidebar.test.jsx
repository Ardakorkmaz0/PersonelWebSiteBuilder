import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import Sidebar from './Sidebar.jsx'
import { paletteItems } from '../registry.jsx'
import { HTML_VARIANTS } from '../../utils/htmlVariants.js'

function renderSidebar() {
  return render(
    <LanguageProvider>
      <DndContext>
        <Sidebar />
      </DndContext>
    </LanguageProvider>,
  )
}

describe('Sidebar component recommendations', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('pwb_language', 'en')
  })

  it('shows the recommended Bootstrap navbar inside the Navbar variants', async () => {
    const user = userEvent.setup()
    renderSidebar()

    expect(screen.getByText('Bootstrap variants')).toBeInTheDocument()
    expect(screen.queryByText('Bootstrap Navbar')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^☰Navbar\d+▸$/ }))

    expect(screen.getAllByText('Bootstrap Navbar')).toHaveLength(2)
    expect(screen.getByText('Recommended')).toBeInTheDocument()

    expect(paletteItems.find((item) => item.type === 'navbar')).toEqual({
      type: 'navbar',
      label: 'Navbar',
      icon: '☰',
    })
    expect(HTML_VARIANTS.navbar[0]).toMatchObject({
      id: 'bootstrap',
      label: 'Bootstrap Navbar',
      foundation: 'bootstrap',
      recommended: true,
    })
    expect(HTML_VARIANTS.navbar[0].html).toContain('class="navbar navbar-expand-lg')
  })

  it('adds one recommended Bootstrap choice to every compatible component category', () => {
    const compatibleTypes = [
      'navbar', 'heading', 'text', 'button', 'linkbutton', 'image', 'section', 'card', 'list',
      'quote', 'badge', 'input', 'select', 'alert', 'accordion', 'container', 'tabs', 'divider', 'spacer',
    ]

    for (const type of compatibleTypes) {
      expect(HTML_VARIANTS[type][0]).toMatchObject({
        id: 'bootstrap',
        foundation: 'bootstrap',
        recommended: true,
      })
      expect(HTML_VARIANTS[type].filter((variant) => variant.recommended)).toHaveLength(1)
    }

    for (const type of ['icon', 'html']) {
      expect(HTML_VARIANTS[type].some((variant) => variant.recommended)).toBe(false)
    }
  })
})
