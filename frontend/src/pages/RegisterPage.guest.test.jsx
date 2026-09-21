// Signing up from a guest session is not a second account.
//
// If this form called register() while a guest token was in the store, the
// person would end up with a brand new account and their sites stranded on the
// old identity — the exact thing that makes "try it without signing up" a lie.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../ui/UiThemeProvider.jsx'
import RegisterPage from './RegisterPage.jsx'
import { useAuthStore } from '../store/authStore.js'
import { register, upgradeGuest } from '../api/auth.js'

vi.mock('../api/auth.js', () => ({
  register: vi.fn(),
  upgradeGuest: vi.fn(),
  googleLogin: vi.fn(),
}))
vi.mock('../utils/usePublicConfig.js', () => ({ usePublicConfig: () => ({}) }))

const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}))

function fill() {
  fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'ada' } })
  fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'ada@example.com' } })
  fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'a-strong-pass-42' } })
  fireEvent.click(screen.getByRole('button', { name: /Create/i }))
}

function renderPage() {
  return render(
    <UiThemeProvider>
      <LanguageProvider><MemoryRouter><RegisterPage /></MemoryRouter></LanguageProvider>
    </UiThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('pwb_language', 'en')
  useAuthStore.setState({ token: null, user: null })
})

describe('registering', () => {
  it('creates an account when nobody is signed in', async () => {
    register.mockResolvedValue({ token: 't', user: { id: 1, username: 'ada' } })

    renderPage()
    fill()

    await waitFor(() => expect(register).toHaveBeenCalled())
    expect(upgradeGuest).not.toHaveBeenCalled()
  })

  it('upgrades the guest in place, so their sites stay theirs', async () => {
    useAuthStore.setState({ token: 'guest-token', user: { id: 9, username: 'guest-ab12', is_guest: true } })
    upgradeGuest.mockResolvedValue({ token: 'real-token', user: { id: 9, username: 'ada', is_guest: false } })

    renderPage()
    // The form says what is happening, so nobody thinks they are starting over.
    expect(screen.getByText(/sites you made as a guest stay yours/i)).toBeInTheDocument()
    fill()

    await waitFor(() => expect(upgradeGuest).toHaveBeenCalledWith('ada', 'ada@example.com', 'a-strong-pass-42'))
    expect(register).not.toHaveBeenCalled()
    // Same person, now with a password — and the session keeps working.
    expect(useAuthStore.getState().user.id).toBe(9)
    expect(useAuthStore.getState().user.is_guest).toBe(false)
    expect(useAuthStore.getState().token).toBe('real-token')
  })
})
