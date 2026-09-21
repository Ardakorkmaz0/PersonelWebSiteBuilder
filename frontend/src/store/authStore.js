import { create } from 'zustand'
import { clearGuestCookie, readGuestCookie, writeGuestCookie } from '../utils/guestSession.js'

const TOKEN_KEY = 'pwb_token'
const USER_KEY = 'pwb_user'

// "Remember me" decides the store: localStorage persists across browser restarts,
// sessionStorage clears when the tab/window closes. We read from whichever holds
// the session and always clear both on logout.
function read(key) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

function readUser() {
  try {
    return JSON.parse(read(USER_KEY) || 'null')
  } catch {
    return null
  }
}

// A guest has no password to sign back in with, so a cleared localStorage
// would strand their drafts on an identity nobody can reach. The cookie copy
// is the second chance: whichever survived rebuilds the session.
function restoreSession() {
  const token = read(TOKEN_KEY)
  const user = readUser()
  if (token && user) return { token, user }
  const kept = readGuestCookie()
  if (!kept) return { token: null, user: null }
  localStorage.setItem(TOKEN_KEY, kept.token)
  localStorage.setItem(USER_KEY, JSON.stringify(kept.user))
  return kept
}

const restored = restoreSession()

function activeStore() {
  return localStorage.getItem(TOKEN_KEY) != null ? localStorage : sessionStorage
}

export const useAuthStore = create((set) => ({
  token: restored.token,
  user: restored.user,

  setAuth: (token, user, remember = true) => {
    const store = remember ? localStorage : sessionStorage
    const other = remember ? sessionStorage : localStorage
    store.setItem(TOKEN_KEY, token)
    store.setItem(USER_KEY, JSON.stringify(user))
    other.removeItem(TOKEN_KEY)
    other.removeItem(USER_KEY)
    // Only a guest gets the second copy: an account can always sign in again,
    // and a spare copy of its token is exposure with nothing to buy.
    if (user?.is_guest) writeGuestCookie(token, user)
    else clearGuestCookie()
    set({ token, user })
  },

  // Refresh just the user (e.g. after a profile/avatar update) — write to
  // whichever store currently holds the session.
  setUser: (user) => {
    activeStore().setItem(USER_KEY, JSON.stringify(user))
    if (user?.is_guest) writeGuestCookie(read(TOKEN_KEY), user)
    else clearGuestCookie()
    set({ user })
  },

  logout: () => {
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(TOKEN_KEY)
      s.removeItem(USER_KEY)
    }
    clearGuestCookie()
    set({ token: null, user: null })
  },
}))

// "Continue without signing in" hands out a real identity with a made-up name.
// The app reads this to stop offering what that identity cannot do, rather
// than letting the server refuse it after the click — a Publish button that
// always fails is worse than no Publish button.
export function useIsGuest() {
  return useAuthStore((s) => !!s.user?.is_guest)
}
