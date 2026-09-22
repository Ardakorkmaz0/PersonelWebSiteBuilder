// A wrong address used to bounce straight home with no explanation, so a
// mistyped link and a moved page looked identical — like the app had eaten the
// request. The 404 now says what happened, then still goes home, which is what
// the old redirect did and what these tests hold on to.
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import NotFoundPage from './NotFoundPage.jsx'

function renderAt(path) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>ana sayfa</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  )
}

describe('the 404 page', () => {
  beforeEach(() => {
    localStorage.setItem('pwb_language', 'en')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('says a page is missing instead of silently going home', () => {
    renderAt('/there-is-no-such-page')

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.queryByText('ana sayfa')).toBeNull()
  })

  it('shows the address that was not found', () => {
    // Without it, somebody who followed a bad link cannot tell which link.
    renderAt('/projects/missing-one')

    expect(screen.getByText('/projects/missing-one')).toBeInTheDocument()
  })

  it('still takes them home, just later', () => {
    renderAt('/nope')

    act(() => { vi.advanceTimersByTime(6000) })

    expect(screen.getByText('ana sayfa')).toBeInTheDocument()
  })

  it('does not leave before the countdown is done', () => {
    renderAt('/nope')

    act(() => { vi.advanceTimersByTime(3000) })

    expect(screen.queryByText('ana sayfa')).toBeNull()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('counts down out loud', () => {
    renderAt('/nope')

    expect(screen.getByRole('status')).toHaveTextContent('6')
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByRole('status')).toHaveTextContent('4')
  })

  it('offers a way out for anyone who does not want to wait', () => {
    renderAt('/nope')

    expect(screen.getByRole('link', { name: /go home now/i })).toHaveAttribute('href', '/')
  })

  it('reads 404 once, not three times', () => {
    // The coloured plates are drawn with CSS ::before/::after and an
    // aria-hidden copy, so a screen reader hears the number a single time.
    renderAt('/nope')

    expect(screen.getAllByText('404')).toHaveLength(1)
  })
})
