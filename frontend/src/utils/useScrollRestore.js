import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Remember and restore the window scroll position for a route, so returning to
// the Explore feed or Profile lands you exactly where you left off instead of
// snapping back to the top.
//
// Pass `ready` = true once the content that gives the page its height has
// rendered (e.g. the feed items have loaded) — otherwise the page is too short
// for window.scrollTo to reach the saved offset and the restore is clamped.
export function useScrollRestore(ready = true) {
  const { pathname } = useLocation()
  const key = `pwb-scroll:${pathname}`

  // Continuously remember the position (a cheap sessionStorage write per scroll
  // event) and capture the final position when navigating away.
  useEffect(() => {
    const save = () => sessionStorage.setItem(key, String(Math.round(window.scrollY)))
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      save()
      window.removeEventListener('scroll', save)
    }
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
