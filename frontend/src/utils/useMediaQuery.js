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
// .98 instead of a round 1023 so fractional viewport widths (e.g. 1023.33 on
// scaled displays) fall on the same side of the boundary as Tailwind's lg:
// (min-width: 1024px) — otherwise the sliver in between mixes both layouts.
export const NARROW_EDITOR_QUERY = '(max-width: 1023.98px)'

// Phones use a preview-first editor shell. The full drag/drop editor remains
// available on tablets and desktops where there is enough room to work.
export const MOBILE_EDITOR_QUERY = '(max-width: 767.98px)'
