export const UI_THEME_STORAGE_KEY = 'pwb_ui_theme'
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

const VALID_PREFERENCES = new Set(['light', 'dark', 'system'])

export function readUiThemePreference(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(UI_THEME_STORAGE_KEY)
    return VALID_PREFERENCES.has(saved) ? saved : 'dark'
  } catch {
    return 'dark'
  }
}
