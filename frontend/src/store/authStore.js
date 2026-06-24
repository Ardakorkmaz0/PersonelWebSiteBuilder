import { create } from 'zustand'

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

function activeStore() {
  return localStorage.getItem(TOKEN_KEY) != null ? localStorage : sessionStorage
}

export const useAuthStore = create((set) => ({
  token: read(TOKEN_KEY) || null,
  user: readUser(),

  setAuth: (token, user, remember = true) => {
    const store = remember ? localStorage : sessionStorage
    const other = remember ? sessionStorage : localStorage
    store.setItem(TOKEN_KEY, token)
    store.setItem(USER_KEY, JSON.stringify(user))
    other.removeItem(TOKEN_KEY)
    other.removeItem(USER_KEY)
    set({ token, user })
  },

  // Refresh just the user (e.g. after a profile/avatar update) — write to
  // whichever store currently holds the session.
  setUser: (user) => {
    activeStore().setItem(USER_KEY, JSON.stringify(user))
    set({ user })
  },

  logout: () => {
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(TOKEN_KEY)
      s.removeItem(USER_KEY)
    }
    set({ token: null, user: null })
  },
}))
