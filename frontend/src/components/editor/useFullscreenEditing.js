// Full-screen editing: the rails go away and the window goes with them.
//
// Two things happen together on purpose. Hiding the side panels alone still
// leaves the browser's own chrome eating a couple of hundred pixels; asking for
// real full screen alone leaves the rails taking a third of it back. Doing both
// is what actually turns a laptop into a canvas.
//
// The rail preferences are NOT written while this is on — the editor derives
// "closed" from this flag instead, so leaving full screen puts the panels back
// exactly as they were rather than as whatever they happened to be.

import { useCallback, useEffect, useState } from 'react'

export default function useFullscreenEditing() {
  const [fullscreen, setFullscreen] = useState(false)

  // The browser is the authority: Esc, F11 and the window chrome can all end
  // full screen without going through us, and the rails have to follow.
  useEffect(() => {
    const sync = () => { if (!document.fullscreenElement) setFullscreen(false) }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // Real full screen can be refused — an iframe without the permission, a
  // browser that wants a different gesture. The rails-hidden half still worked,
  // so Esc has to be able to undo it even when there is no fullscreenchange
  // event coming.
  useEffect(() => {
    if (!fullscreen) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape' || document.fullscreenElement) return
      setFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const toggleFullscreen = useCallback(() => {
    setFullscreen((on) => {
      if (on) {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
        return false
      }
      // Requested, not awaited: if the browser refuses, the panels still get
      // out of the way, which is most of the value.
      document.documentElement?.requestFullscreen?.().catch(() => {})
      return true
    })
  }, [])

  return { fullscreen, toggleFullscreen }
}
