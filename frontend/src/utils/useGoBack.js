import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// A "real" back button: go to the page you actually came from instead of
// hard-coding the home route. React Router stamps an incrementing `idx` on
// history.state for every in-app navigation, so `idx > 0` means there's an
// earlier in-app entry to pop back to. With no in-app entry but real browser
// history (the user arrived from outside the app), a native history.back()
// still returns to the previous page. Only a truly fresh tab falls back to
// `fallback` so the button never strands the user on a blank history step.
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else if (window.history.length > 1) window.history.back()
    else navigate(fallback)
  }, [navigate, fallback])
}
