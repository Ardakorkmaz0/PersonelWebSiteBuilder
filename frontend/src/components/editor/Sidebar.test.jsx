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

    // Discovery moved to the BlockLibrary overlay; the rail opens it from here.
    expect(screen.getByRole('button', { name: /Browse all blocks/ })).toBeInTheDocument()
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

  it('hides Region creation while preserving its registry support for existing projects', () => {
    renderSidebar()

    expect(paletteItems.some((item) => item.type === 'region')).toBe(true)
    expect(screen.queryByText('Region')).not.toBeInTheDocument()
  })

  it('deletes a saved custom block accessibly and can undo the deletion', async () => {
    const user = userEvent.setup()
    localStorage.setItem('pwb_custom_blocks', JSON.stringify([{
      id: 'custom-test',
      label: 'Reusable hero',
      desc: 'Saved custom HTML',
      html: '<section>Hero</section>',
    }]))
    renderSidebar()

    await user.click(screen.getByRole('button', { name: /Custom HTML/ }))
    await user.click(screen.getByRole('button', { name: 'Delete saved block: Reusable hero' }))

    expect(screen.queryByText('Reusable hero')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('pwb_custom_blocks'))).toEqual([])
    expect(screen.getByText('Saved block deleted: Reusable hero').closest('[role="status"]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Reusable hero')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('pwb_custom_blocks'))).toHaveLength(1)
  })
})
