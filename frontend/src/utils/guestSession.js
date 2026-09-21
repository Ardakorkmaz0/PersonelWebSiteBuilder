// A guest identity is only as durable as the one slot it is kept in.
//
// There is no password behind it: whatever holds the token IS the account. So
// a browser that clears site data — a private window closing, "clear cookies
// on exit", Brave's forget-first-party shield, Safari's 7-day cap on
// script-written storage, or the person clearing it by hand — does not just
// sign them out. It strands every draft on an identity nobody can reach again,
// and the next visit mints a different guest.
//
// Nothing here makes that impossible. It makes it less likely: the token is
// also mirrored into a first-party cookie, and a session is rebuilt from
// whichever copy survived. Cleaners that take one store often leave the other
// (a cookie cleaner does not touch localStorage; a "clear localStorage" does
// not touch cookies). A wipe that takes both is what the recovery code and,
// better, an account are for.
const COOKIE = 'pwb_guest'
const YEAR = 60 * 60 * 24 * 365

export function readGuestCookie() {
  try {
    const match = document.cookie.match(/(?:^|;\s*)pwb_guest=([^;]*)/)
    if (!match) return null
    const parsed = JSON.parse(decodeURIComponent(match[1]))
    return parsed?.token && parsed?.user?.is_guest ? parsed : null
  } catch {
    return null
  }
}

export function writeGuestCookie(token, user) {
  try {
    const value = encodeURIComponent(JSON.stringify({ token, user }))
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${COOKIE}=${value}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`
  } catch {
    /* a browser that refuses cookies still has localStorage */
  }
}

export function clearGuestCookie() {
  try {
    document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  } catch {
    /* nothing to clear */
  }
}
