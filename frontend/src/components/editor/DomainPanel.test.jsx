// Connecting a domain, said in the order it is done.
//
// The old panel was a box and a table: you typed a domain, saw two records,
// and then nothing ever happened — no check existed, so the status said
// "waiting for DNS" forever. These pin the four steps, and that a failed check
// says which thing to fix rather than just failing.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import DomainPanel from './DomainPanel.jsx'
import { configureDomain, getDomainSetup, verifyDomain } from '../../api/sites.js'

vi.mock('../../api/sites.js', () => ({
  getDomainSetup: vi.fn(),
  configureDomain: vi.fn(),
  verifyDomain: vi.fn(),
}))

const RECORDS = [
  { type: 'CNAME', name: 'www', value: 'sites.example.com' },
  { type: 'A', name: '@', value: '203.0.113.9' },
]

function renderPanel(onStatus = vi.fn()) {
  return render(
    <UiThemeProvider>
      <LanguageProvider><DomainPanel siteId={4} onStatus={onStatus} /></LanguageProvider>
    </UiThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('pwb_language', 'en')
  getDomainSetup.mockResolvedValue({ domain: '', status: 'not_connected', records: [], checked: null })
})

describe('the four steps', () => {
  it('starts by asking for the domain, with the rest still ahead', async () => {
    renderPanel()

    expect(await screen.findByLabelText('Your domain')).toHaveValue('')
    expect(screen.getByText('2. Add these records at your domain provider')).toBeInTheDocument()
    expect(screen.getByText('Enter a domain first.')).toBeInTheDocument()
  })

  it('saves the domain and then shows what to put in DNS', async () => {
    configureDomain.mockResolvedValue({
      domain: 'ada.example', status: 'pending', records: RECORDS, checked: null,
    })
    renderPanel()

    fireEvent.change(await screen.findByLabelText('Your domain'), { target: { value: 'ada.example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save domain' }))

    await waitFor(() => expect(configureDomain).toHaveBeenCalledWith(4, 'ada.example'))
    // Both shapes: www takes a CNAME, an apex cannot.
    expect(await screen.findByText('sites.example.com')).toBeInTheDocument()
    expect(screen.getByText('203.0.113.9')).toBeInTheDocument()
  })

  it('checks the connection and says the site is live when it passes', async () => {
    getDomainSetup.mockResolvedValue({ domain: 'ada.example', status: 'pending', records: RECORDS, checked: null })
    verifyDomain.mockResolvedValue({ domain: 'ada.example', status: 'connected', records: RECORDS, checked: 'ok' })
    const onStatus = vi.fn()
    renderPanel(onStatus)

    fireEvent.click(await screen.findByRole('button', { name: 'Check now' }))

    await waitFor(() => expect(verifyDomain).toHaveBeenCalledWith(4))
    expect(await screen.findByRole('link', { name: 'ada.example' })).toHaveAttribute('href', 'https://ada.example')
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'connected' }))
  })

  // A check that only says "no" leaves people staring at their DNS panel.
  it('says which thing to fix when the check fails', async () => {
    getDomainSetup.mockResolvedValue({ domain: 'ada.example', status: 'pending', records: RECORDS, checked: null })
    verifyDomain.mockResolvedValue({
      domain: 'ada.example', status: 'pending', records: RECORDS, checked: 'points_elsewhere',
    })
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'Check now' }))

    expect(await screen.findByText(/resolves somewhere else/i)).toBeInTheDocument()
  })

  it('explains a domain that has not propagated yet as waiting, not as broken', async () => {
    getDomainSetup.mockResolvedValue({
      domain: 'ada.example', status: 'pending', records: RECORDS, checked: 'not_resolving',
    })
    renderPanel()

    expect(await screen.findByText(/does not resolve yet/i)).toBeInTheDocument()
  })

  it('says what lives on the domain and what does not', async () => {
    renderPanel()
    expect(await screen.findByText(/Only your published pages are served on your domain/i)).toBeInTheDocument()
  })

  it('reports a failure instead of looking like nothing happened', async () => {
    getDomainSetup.mockResolvedValue({ domain: 'ada.example', status: 'pending', records: RECORDS, checked: null })
    verifyDomain.mockRejectedValue({ response: { data: { detail: 'Add a domain first.' } } })
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'Check now' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Add a domain first.')
  })
})
