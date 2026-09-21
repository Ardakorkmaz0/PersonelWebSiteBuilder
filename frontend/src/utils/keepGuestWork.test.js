// Whatever door they come through, the work comes with them.
//
// Measured on the dev database before this existed: a guest with a site at
// 22:03, an account created at 22:05, and the site still sitting on the guest
// — an identity with no password to ever reach it again.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { keepGuestWork } from './keepGuestWork.js'
import { adoptGuestWork } from '../api/auth.js'

vi.mock('../api/auth.js', () => ({ adoptGuestWork: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('keeping what was made as a guest', () => {
  it('takes it over when a guest signs into an account', async () => {
    adoptGuestWork.mockResolvedValue({ moved: { sites: 2, images: 1, favorites: 0 } })

    const moved = await keepGuestWork({
      token: 'guest-token',
      user: { id: 5, is_guest: true },
      nextUserId: 9,
    })

    expect(adoptGuestWork).toHaveBeenCalledWith('guest-token')
    expect(moved).toEqual({ sites: 2, images: 1, favorites: 0 })
  })

  it('does nothing for someone who was already signed in', async () => {
    expect(await keepGuestWork({ token: 'real', user: { id: 5, is_guest: false }, nextUserId: 9 })).toBe(null)
    expect(await keepGuestWork(null)).toBe(null)
    expect(adoptGuestWork).not.toHaveBeenCalled()
  })

  // Signing up FROM a guest session upgrades that row in place: same id, same
  // sites. Asking the server to move them to itself would be nonsense.
  it('does nothing when the account is the same row', async () => {
    expect(await keepGuestWork({ token: 'guest', user: { id: 5, is_guest: true }, nextUserId: 5 })).toBe(null)
    expect(adoptGuestWork).not.toHaveBeenCalled()
  })

  it('says nothing when there was nothing to move', async () => {
    adoptGuestWork.mockResolvedValue({ moved: { sites: 0, images: 0, favorites: 0 } })
    expect(await keepGuestWork({ token: 'g', user: { id: 5, is_guest: true }, nextUserId: 9 })).toBe(null)
  })

  // Signing in is the important part; a failed move must never break it.
  it('never throws in the middle of signing in', async () => {
    adoptGuestWork.mockRejectedValue(new Error('offline'))
    await expect(keepGuestWork({ token: 'g', user: { id: 5, is_guest: true }, nextUserId: 9 })).resolves.toBe(null)
  })
})
