import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import CanvasSelectionActions from './CanvasSelectionActions.jsx'

function loadNestedCanvas() {
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{
      id: 'p1',
      name: 'Home',
      components: [{
        id: 'parent',
        type: 'container',
        props: {},
        styles: {},
        layout: { x: 0, y: 0, w: 600, h: 300 },
        children: [{
          id: 'child',
          type: 'text',
          props: { text: 'Nested' },
          styles: {},
          layout: { x: 10, y: 10, w: 120, h: 40 },
        }],
      }],
    }],
  })
}

describe('CanvasSelectionActions', () => {
  it('exposes the same quick actions and can jump to the parent component', async () => {
    localStorage.setItem('pwb_language', 'en')
    loadNestedCanvas()
    const user = userEvent.setup()

    render(
      <LanguageProvider>
        <CanvasSelectionActions componentId="child" />
      </LanguageProvider>,
    )

    expect(screen.getByRole('toolbar', { name: 'Arrange' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Backward' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Forward' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete component' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Select parent' }))
    expect(useEditorStore.getState().selectedId).toBe('parent')
  })
})
