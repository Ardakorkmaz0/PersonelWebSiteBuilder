import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { serializeDocument } from '../../utils/htmlPlacement.js'
import { installSelectionResizeChrome } from './HtmlWorkspace.jsx'
import { hasUnsavedSourceDraft } from '../../utils/htmlSourceDraft.js'

describe('HTML source save state', () => {
  it('marks only changed source drafts as unsaved', () => {
    expect(hasUnsavedSourceDraft('source', '<p>new</p>', '<p>old</p>')).toBe(true)
    expect(hasUnsavedSourceDraft('source', '<p>same</p>', '<p>same</p>')).toBe(false)
    expect(hasUnsavedSourceDraft('view', '<p>new</p>', '<p>old</p>')).toBe(false)
  })
})

describe('HTML selection quick actions', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main><p id="selected">Hello</p></main>'
  })

  it('shows the common actions next to the selected element', () => {
    const selected = document.getElementById('selected')
    selected.getBoundingClientRect = () => ({
      left: 20,
      top: 80,
      right: 220,
      bottom: 120,
      width: 200,
      height: 40,
    })
    const onAction = vi.fn()

    installSelectionResizeChrome(document, selected, vi.fn(), onAction, {
      toolbar: 'Düzenle',
      parent: 'Üst öğeyi seç',
      duplicate: 'Çoğalt',
      up: 'Yukarı taşı',
      down: 'Aşağı taşı',
      delete: 'Bileşeni sil',
    })

    const toolbar = document.querySelector('[data-pwb-selection-toolbar]')
    expect(toolbar).toHaveAttribute('role', 'toolbar')
    expect(toolbar).toHaveAttribute('aria-label', 'Düzenle')
    expect(toolbar.style.top).toBe('-40px')
    expect(toolbar.querySelectorAll('[data-pwb-selection-action]')).toHaveLength(5)

    fireEvent.click(toolbar.querySelector('[data-pwb-selection-action="delete"]'))
    expect(onAction).toHaveBeenCalledWith('delete')
  })

  it('flips below top-edge selections and never leaks into saved HTML', () => {
    const selected = document.getElementById('selected')
    selected.getBoundingClientRect = () => ({
      left: 4,
      top: 6,
      right: 204,
      bottom: 46,
      width: 200,
      height: 40,
    })

    installSelectionResizeChrome(document, selected, vi.fn(), vi.fn())

    expect(document.querySelector('[data-pwb-selection-toolbar]').style.top).toBe('48px')
    expect(serializeDocument(document)).not.toContain('data-pwb-selection-toolbar')
    expect(serializeDocument(document)).not.toContain('data-pwb-selection-action')
  })
})
