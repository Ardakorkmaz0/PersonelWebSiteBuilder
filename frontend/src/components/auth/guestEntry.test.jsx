// The door for someone who has not decided yet, and the door out of it.
//
// A sign-up form in front of a product nobody has seen is where most visitors
// leave. These pin the two halves of the answer: getting in without a password,
// and being told — in the same words every time — where an account is actually
// needed.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import GuestEntry from './GuestEntry.jsx'
import GuestGateDialog from './GuestGate.jsx'
import { useAuthStore } from '../../store/authStore.js'
import { continueAsGuest } from '../../api/auth.js'

vi.mock('../../api/auth.js', () => ({ continueAsGuest: vi.fn() }))

const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}))

function renderWithShell(ui) {
  return render(
    <UiThemeProvider>
      <LanguageProvider><MemoryRouter>{ui}</MemoryRouter></LanguageProvider>
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

describe('continuing without an account', () => {
  it('takes the visitor straight in with the identity the server made', async () => {
    continueAsGuest.mockResolvedValue({
      token: 'guest-token',
      user: { id: 7, username: 'guest-ab12cd34', is_guest: true },
    })

    renderWithShell(<GuestEntry />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue without signing in' }))

    await waitFor(() => expect(useAuthStore.getState().token).toBe('guest-token'))
    expect(useAuthStore.getState().user.is_guest).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('says what the offer is, so nobody is surprised later', () => {
    renderWithShell(<GuestEntry />)
    expect(screen.getByText(/Publishing needs an account/i)).toBeInTheDocument()
  })

  it('reports a failure instead of pretending it worked', async () => {
    continueAsGuest.mockRejectedValue(new Error('offline'))
    const onError = vi.fn()

    renderWithShell(<GuestEntry onError={onError} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue without signing in' }))

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(useAuthStore.getState().token).toBe(null)
  })
})

describe('being told an account is needed', () => {
  it('names the thing they tried and offers the step, not a wall', () => {
    renderWithShell(<GuestGateDialog action="publish" onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'An account is needed' })).toBeInTheDocument()
    expect(screen.getByText(/Publishing puts your site in front of other people/i)).toBeInTheDocument()
    // The part that makes it safe to say yes.
    expect(screen.getByText(/Everything you have made so far comes with you/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }))
    expect(navigate).toHaveBeenCalledWith('/register')
  })

  it('has its own words for each closed door', () => {
    const { unmount } = renderWithShell(<GuestGateDialog action="domain" onClose={vi.fn()} />)
    expect(screen.getByText(/custom domain is attached to an account/i)).toBeInTheDocument()
    unmount()

    renderWithShell(<GuestGateDialog action="report" onClose={vi.fn()} />)
    expect(screen.getByText(/claim about someone else/i)).toBeInTheDocument()
  })

  it('closes without doing anything when they are not ready', () => {
    const onClose = vi.fn()
    renderWithShell(<GuestGateDialog action="publish" onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onClose).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
