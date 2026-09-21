import { adoptGuestWork } from '../api/auth.js'

// Whatever door they come through, the work comes with them.
//
// Signing UP from a guest session upgrades that same row, so there is nothing
// to move. But someone can also sign IN to an account they already had, use
// Google, or submit a register form from a tab opened before any of this
// existed — and then a brand new row would own nothing while their sites sat
// on an identity with no password to reach it. Measured on the dev database
// after exactly that: a guest with a site, an account two minutes later, and
// the site still on the guest.
//
// Called after the new session is stored, so the request carries the new
// token. Never throws: a failed move must not break signing in.
export async function keepGuestWork(previous) {
  const token = previous?.token
  if (!token || !previous?.user?.is_guest) return null
  // The upgrade path keeps the same row; there is nothing to take over.
  if (previous.user.id && previous.user.id === previous.nextUserId) return null
  try {
    const { moved } = await adoptGuestWork(token)
    const total = (moved?.sites || 0) + (moved?.images || 0) + (moved?.favorites || 0)
    return total ? moved : null
  } catch {
    return null
  }
}
