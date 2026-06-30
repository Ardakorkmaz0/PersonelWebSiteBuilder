import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// A "real" back button: go to the page you actually came from instead of
// hard-coding the home route. React Router stamps an incrementing `idx` on
// history.state for every in-app navigation, so `idx > 0` means there's an
// earlier in-app entry to pop back to. When there isn't one (the page was
// opened directly / in a fresh tab), fall back to `fallback` so the button
// never strands the user on a blank history step.
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(fallback)
  }, [navigate, fallback])
}
