import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Remember and restore the window scroll position for a route, so returning to
// the Explore feed or Profile lands you exactly where you left off instead of
// snapping back to the top.
//
// Pass `ready` = true once the content that gives the page its height has
// rendered (e.g. the feed items have loaded) — otherwise the page is too short
// for window.scrollTo to reach the saved offset and the restore is clamped.
//
// `scope` separates positions that share a URL. The Explore feed filters by
// category without changing the path, and one saved offset for all of them is
// wrong in both directions: it drops you into the middle of a short list, and
// it forgets where you were in the long one.
function scrollKey(pathname, scope = '') {
  return `pwb-scroll:${pathname}${scope ? `|${scope}` : ''}`
}

// Drop a remembered position. Used when a deliberate action replaces the list
// under the person — filtering, say — where restoring the old offset would be
// answering a question they did not ask.
export function forgetScroll(pathname, scope = '') {
  sessionStorage.removeItem(scrollKey(pathname, scope))
}

export function useScrollRestore(ready = true, scope = '') {
  const { pathname } = useLocation()
  const key = scrollKey(pathname, scope)

  // The scroll listener is the ONLY writer. It already holds the last place the
  // person actually was, so there is nothing to capture on the way out — and a
  // save during cleanup would be actively wrong: when the list shrinks (a
  // filter, an emptied feed) the browser scrolls up on its own first, and that
  // clamped number would overwrite the real position under the old key.
  useEffect(() => {
    const save = () => sessionStorage.setItem(key, String(Math.round(window.scrollY)))
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [key])

  // Restore once the content is ready. Two rAFs so it runs after the browser has
  // laid out the freshly-rendered content (one frame to commit the DOM, one to
  // paint), which is when the document is finally tall enough to scroll.
  useEffect(() => {
    if (!ready) return undefined
    const saved = sessionStorage.getItem(key)
    const y = saved == null ? 0 : parseInt(saved, 10) || 0
    if (y <= 0) return undefined
    let raf2
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => window.scrollTo(0, y))
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [ready, key])
}
