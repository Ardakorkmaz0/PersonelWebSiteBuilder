import { useEffect, useMemo, useState } from 'react'
import { UiThemeContext } from './uiThemeContext.js'
import { readUiThemePreference, SYSTEM_DARK_QUERY, UI_THEME_STORAGE_KEY } from './uiTheme.js'

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
    try { localStorage.setItem(UI_THEME_STORAGE_KEY, preference) } catch { /* storage unavailable */ }
  }, [preference, theme])

  const value = useMemo(() => ({ preference, setPreference, theme }), [preference, theme])
  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>
}
