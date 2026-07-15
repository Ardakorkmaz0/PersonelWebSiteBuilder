import { useContext } from 'react'
import { LanguageContext } from './context.js'

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}
