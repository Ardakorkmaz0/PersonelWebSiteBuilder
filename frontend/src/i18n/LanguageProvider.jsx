import { useEffect, useMemo, useState } from 'react'
import { LanguageContext } from './context.js'
import {
  detectInitialLanguage,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  translate,
} from './language.js'

export default function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage)

  const setLanguage = (next) => {
    if (!SUPPORTED_LANGUAGES.includes(next)) return
    setLanguageState(next)
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next) } catch { /* ignore */ }
  }

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key, variables) => translate(language, key, variables),
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
