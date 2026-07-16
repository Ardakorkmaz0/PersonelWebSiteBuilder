import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'pwb_ui_theme'
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'
const VALID_PREFERENCES = new Set(['light', 'dark', 'system'])

const UiThemeContext = createContext(null)

export function readUiThemePreference(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY)
    return VALID_PREFERENCES.has(saved) ? saved : 'dark'
  } catch {
    return 'dark'
  }
}

function systemTheme() {
  return globalThis.matchMedia?.(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light'
}

export default function UiThemeProvider({ children }) {
  const [preference, setPreference] = useState(readUiThemePreference)
  const [systemPreference, setSystemPreference] = useState(systemTheme)
  const theme = preference === 'system' ? systemPreference : preference

  useEffect(() => {
    const media = globalThis.matchMedia?.(SYSTEM_DARK_QUERY)
    if (!media) return undefined
    const update = () => setSystemPreference(media.matches ? 'dark' : 'light')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.uiTheme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem(STORAGE_KEY, preference) } catch { /* storage unavailable */ }
  }, [preference, theme])

  const value = useMemo(() => ({ preference, setPreference, theme }), [preference, theme])
  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>
}

export function useUiTheme() {
  const value = useContext(UiThemeContext)
  if (!value) throw new Error('useUiTheme must be used inside UiThemeProvider')
  return value
}
