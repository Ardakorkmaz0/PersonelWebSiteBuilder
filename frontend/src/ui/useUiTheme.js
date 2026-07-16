import { useContext } from 'react'
import { UiThemeContext } from './uiThemeContext.js'

export function useUiTheme() {
  const value = useContext(UiThemeContext)
  if (!value) throw new Error('useUiTheme must be used inside UiThemeProvider')
  return value
}
