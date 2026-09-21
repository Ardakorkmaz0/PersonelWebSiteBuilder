import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import { useAuthStore } from '../../store/authStore.js'
import DashboardHeader from './DashboardHeader.jsx'

vi.mock('./DashboardGlobalSearch.jsx', () => ({ default: () => null }))
vi.mock('./AppInfo.jsx', () => ({ default: () => null }))

beforeEach(() => {
  localStorage.setItem('pwb_language', 'en')
  useAuthStore.setState({ user: { id: 700, username: 'tester' }, token: 'test-session' })
})

function renderHeader() {
  return render(<UiThemeProvider><LanguageProvider><MemoryRouter>
    <DashboardHeader />
    <input aria-label="Outside the header" />
  </MemoryRouter></LanguageProvider></UiThemeProvider>)
}

describe('DashboardHeader Escape focus', () => {
  it('returns focus to the account trigger when Escape closes its focused menu', async () => {
    const user = userEvent.setup()
    renderHeader()
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    await user.click(trigger)
    await user.tab()
    expect(screen.getByRole('link', { name: 'Profile and projects' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Profile and projects' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the mobile trigger when Escape closes a focused navigation link', async () => {
    const user = userEvent.setup()
    renderHeader()
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    await user.click(trigger)
    const menu = screen.getByRole('navigation', { name: 'Mobile navigation' })
    within(menu).getByRole('link', { name: 'Favorites' }).focus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('does not steal focus from outside the header when Escape dismisses an open menu', async () => {
    const user = userEvent.setup()
    renderHeader()
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    await user.click(trigger)
    const outside = screen.getByRole('textbox', { name: 'Outside the header' })
    outside.focus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(outside).toHaveFocus()
  })
})
