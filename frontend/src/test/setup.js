// Global Vitest setup: register @testing-library/jest-dom custom matchers
// (toBeInTheDocument, toHaveAttribute, …) and clean up the DOM between tests
// so leftover nodes from a previous test never affect the next assertion.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  // Tests routinely write to localStorage (provider/key/model/chat history);
  // wipe it after each test so the next one starts in a known state.
  try { localStorage.clear() } catch { /* ignore */ }
})

// jsdom doesn't ship matchMedia. Several editor effects call it (responsive
// canvas hints, etc.) so stub it out as "no match" by default — individual
// tests can override window.matchMedia if they need a specific result.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
