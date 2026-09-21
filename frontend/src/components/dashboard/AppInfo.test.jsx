import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import AppInfo from './AppInfo.jsx'
import { APP_FEATURES } from '../../utils/appFeatures.js'

function renderInfo() {
  return render(<UiThemeProvider><LanguageProvider><header><AppInfo /></header></LanguageProvider></UiThemeProvider>)
}

const trigger = () => screen.getByRole('button', { name: 'Quick guide' })

describe('AppInfo starting guide', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('pwb_language', 'en')
  })

  it('has a named trigger and reveals exactly three clear starting options in a modal outside the header', async () => {
    const user = userEvent.setup()
    renderInfo()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog')
    await user.click(trigger())
    const dialog = screen.getByRole('dialog', { name: 'Your website starts here' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(trigger()).toHaveAttribute('aria-controls', dialog.id)
    expect(screen.getByRole('banner')).not.toContainElement(dialog)
    expect(within(dialog).getAllByRole('heading', { level: 3 })).toHaveLength(3)
    for (const feature of APP_FEATURES) {
      expect(within(dialog).getByRole('heading', { name: feature.title })).toBeInTheDocument()
      expect(within(dialog).getByText(feature.summary)).toBeInTheDocument()
      for (const point of feature.points) expect(within(dialog).getByText(point)).toBeInTheDocument()
    }
    expect(within(dialog).getByText(/Early version/)).toHaveTextContent('Chrome or Edge')
  })

  it('keeps keyboard focus inside, locks background scrolling and restores both on Escape', async () => {
    const user = userEvent.setup()
    renderInfo()
    const initialOverflow = document.body.style.overflow
    await user.click(trigger())
    const close = screen.getByRole('button', { name: 'Close' })
    const done = screen.getByRole('button', { name: 'Got it' })
    expect(close).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    await user.tab({ shift: true })
    expect(done).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
    expect(document.body.style.overflow).toBe(initialOverflow)
  })

  it.each(['Close', 'Got it'])('closes with %s and returns focus to the guide button', async (label) => {
    const user = userEvent.setup()
    renderInfo()
    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: label }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('ignores clicks on its content and closes only when the backdrop itself is clicked', async () => {
    const user = userEvent.setup()
    renderInfo()
    await user.click(trigger())
    const dialog = screen.getByRole('dialog')
    fireEvent.pointerDown(within(dialog).getByRole('heading', { name: 'Design from scratch' }))
    expect(dialog).toBeInTheDocument()
    fireEvent.pointerDown(dialog.parentElement)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains all three options in Turkish', async () => {
    const user = userEvent.setup()
    localStorage.setItem('pwb_language', 'tr')
    renderInfo()
    await user.click(screen.getByRole('button', { name: 'Rehber' }))
    for (const name of ['Sıfırdan tasarla', 'HTML dosyanı yükle', 'Yerel projeni aç']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })
})
