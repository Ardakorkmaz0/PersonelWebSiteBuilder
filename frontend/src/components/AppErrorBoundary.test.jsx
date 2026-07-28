// A render error used to blank the whole app. These tests pin the recovery
// path, including the part that matters most in the editor: "Try again" must
// re-render WITHOUT a page reload, because the design lives in a store outside
// React and a reload is what actually costs unsaved work.
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppErrorBoundary from './AppErrorBoundary.jsx'
import LanguageProvider from '../i18n/LanguageProvider.jsx'

function Boom({ shouldThrow }) {
  if (shouldThrow) throw new Error('kaboom in render')
  return <p>recovered content</p>
}

function mount(ui, { path = '/editor/1' } = {}) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppErrorBoundary>{ui}</AppErrorBoundary>
      </MemoryRouter>
    </LanguageProvider>,
  )
}

let consoleError

beforeEach(() => {
  // React logs the caught error itself; keep the test output readable.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  delete window.__pwbReportError
})

describe('AppErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    mount(<Boom shouldThrow={false} />)
    expect(screen.getByText('recovered content')).toBeTruthy()
  })

  it('shows a recovery screen instead of a blank page when a child throws', () => {
    mount(<Boom shouldThrow />)
    expect(screen.getByRole('heading')).toBeTruthy()
    expect(screen.getByText('Try again')).toBeTruthy()
    expect(screen.getByText('Reload the page')).toBeTruthy()
  })

  it('is honest about what each recovery costs', () => {
    mount(<Boom shouldThrow />)
    const copy = screen.getByText(/still in memory/i).textContent
    expect(copy).toMatch(/without losing it/i)
    expect(copy).toMatch(/last saved/i)
  })

  it('"Try again" re-renders in place — no page reload, so the store survives', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('kaboom in render')
      return <p>recovered content</p>
    }
    mount(<Flaky />)
    expect(screen.queryByText('recovered content')).toBeNull()

    shouldThrow = false
    fireEvent.click(screen.getByText('Try again'))
    expect(screen.getByText('recovered content')).toBeTruthy()
  })

  it('keeps the stack available without putting it in the user\'s face', () => {
    mount(<Boom shouldThrow />)
    const details = document.querySelector('details')
    expect(details.open).toBe(false)
    expect(details.textContent).toMatch(/kaboom in render/)
  })

  it('hands the error to a reporter when one is installed', () => {
    const seen = []
    window.__pwbReportError = (error, info) => seen.push([error, info])
    mount(<Boom shouldThrow />)
    expect(seen).toHaveLength(1)
    expect(seen[0][0].message).toBe('kaboom in render')
    expect(seen[0][1].componentStack).toBeTruthy()
  })

  it('a throwing reporter cannot mask the original error', () => {
    window.__pwbReportError = () => { throw new Error('reporter is broken') }
    expect(() => mount(<Boom shouldThrow />)).not.toThrow()
    expect(screen.getByText('Try again')).toBeTruthy()
  })
})
