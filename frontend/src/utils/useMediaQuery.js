import { useCallback, useSyncExternalStore } from 'react'

// Reactive window.matchMedia — drives the editor's narrow-screen layout
// (auto-collapsed side rails, drawer overlays) on tablets and phones.
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => matchesQuery(query))
}

export function matchesQuery(query) {
  return typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
}

// The editor chrome (two fixed side rails + multi-row header) needs at least
// ~1024px; below that the rails collapse and open as overlays instead.
export const NARROW_EDITOR_QUERY = '(max-width: 1023px)'
