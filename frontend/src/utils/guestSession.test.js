// A guest has no password, so whatever holds the token IS the account. These
// pin the second copy that makes a cleared localStorage survivable — and the
// rule that only a guest ever gets one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearGuestCookie, readGuestCookie, writeGuestCookie } from './guestSession.js'

const GUEST = { id: 7, username: 'guest-ab12cd34', is_guest: true }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  clearGuestCookie()
  vi.resetModules()
})

afterEach(() => clearGuestCookie())

describe('the spare copy of a guest session', () => {
  it('round-trips the token and who it belongs to', () => {
    writeGuestCookie('guest-token', GUEST)
    expect(readGuestCookie()).toEqual({ token: 'guest-token', user: GUEST })
  })

  it('ignores a cookie that is not a guest', () => {
    document.cookie = `pwb_guest=${encodeURIComponent(JSON.stringify({ token: 't', user: { id: 1 } }))}; Path=/`
    expect(readGuestCookie()).toBe(null)
  })

  it('ignores a damaged cookie instead of throwing', () => {
    document.cookie = 'pwb_guest=not-json; Path=/'
    expect(readGuestCookie()).toBe(null)
  })
})

describe('coming back after the storage was cleared', () => {
  it('rebuilds the session from the copy that survived', async () => {
    writeGuestCookie('guest-token', GUEST)
    // What a "clear site data" (or a private window closing) leaves behind.
    localStorage.clear()

    const { useAuthStore } = await import('../store/authStore.js')

    expect(useAuthStore.getState().token).toBe('guest-token')
    expect(useAuthStore.getState().user).toEqual(GUEST)
    // And it is put back where the rest of the app looks for it.
    expect(localStorage.getItem('pwb_token')).toBe('guest-token')
  })

  it('leaves a signed-out visitor signed out', async () => {
    const { useAuthStore } = await import('../store/authStore.js')
    expect(useAuthStore.getState().token).toBe(null)
  })

  it('keeps no spare copy for a real account', async () => {
    const { useAuthStore } = await import('../store/authStore.js')

    useAuthStore.getState().setAuth('real-token', { id: 2, username: 'ada', is_guest: false })

    expect(readGuestCookie()).toBe(null)
  })

  it('drops the copy when the guest signs out on purpose', async () => {
    const { useAuthStore } = await import('../store/authStore.js')
    useAuthStore.getState().setAuth('guest-token', GUEST)
    expect(readGuestCookie()).not.toBe(null)

    useAuthStore.getState().logout()

    expect(readGuestCookie()).toBe(null)
  })
})
