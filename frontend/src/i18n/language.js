import { TURKISH_TRANSLATIONS } from './translations.js'

export const LANGUAGE_STORAGE_KEY = 'pwb_language'
export const SUPPORTED_LANGUAGES = ['en', 'tr']

function interpolate(text, variables = {}) {
  return text.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match,
  )
}
export function translate(language, key, variables) {
  const text = language === 'tr' ? TURKISH_TRANSLATIONS[key] || key : key
  return interpolate(text, variables)
}

export function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (SUPPORTED_LANGUAGES.includes(saved)) return saved
  } catch { /* storage unavailable */ }
  const browserLanguage = typeof navigator !== 'undefined'
    ? navigator.languages?.[0] || navigator.language || ''
    : ''
  return browserLanguage.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}
