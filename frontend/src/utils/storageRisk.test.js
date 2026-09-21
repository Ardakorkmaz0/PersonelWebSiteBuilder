// A guest identity lives in browser storage and nowhere else, so a browser
// that clears storage on its own turns "continue without signing in" into
// "until you close this window". These pin who gets warned — and, just as
// importantly, who does not: a warning shown to everyone is one nobody reads.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStorageRisk } from './storageRisk.js'

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
const SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

function browser({ ua = CHROME_UA, brave = false, quota = 120 * 1024 * 1024 * 1024 } = {}) {
  vi.stubGlobal('navigator', {
    userAgent: ua,
    ...(brave ? { brave: { isBrave: async () => true } } : {}),
    storage: { estimate: async () => ({ quota }) },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('who needs telling', () => {
  it('warns in a browser that clears site data by policy', async () => {
    browser({ brave: true })
    expect(await readStorageRisk()).toEqual({ risky: true, reason: 'brave' })
  })

  it('warns in a private window, where closing it is the end of the work', async () => {
    browser({ quota: 120 * 1024 * 1024 })
    expect(await readStorageRisk()).toEqual({ risky: true, reason: 'private' })
  })

  it('warns in Safari, which drops stored data after a quiet week', async () => {
    browser({ ua: SAFARI_UA })
    expect(await readStorageRisk()).toEqual({ risky: true, reason: 'webkit' })
  })

  it('stays quiet in an ordinary browser', async () => {
    browser()
    expect(await readStorageRisk()).toEqual({ risky: false, reason: null })
  })

  // Chromium browsers also say AppleWebKit; only Safari means Safari.
  it('does not mistake Chrome for Safari', async () => {
    browser({ ua: CHROME_UA, quota: 200 * 1024 * 1024 * 1024 })
    expect((await readStorageRisk()).risky).toBe(false)
  })

  it('says nothing when it cannot tell', async () => {
    vi.stubGlobal('navigator', {
      userAgent: CHROME_UA,
      storage: { estimate: async () => { throw new Error('denied') } },
    })
    expect(await readStorageRisk()).toEqual({ risky: false, reason: null })
  })
})
