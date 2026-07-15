import { useLanguage } from '../i18n/useLanguage.js'

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, t } = useLanguage()
  return (
    <label className={`flex shrink-0 items-center gap-1.5 ${className}`}>
      <span className="sr-only">{t('Language')}</span>
      <span aria-hidden className="text-sm">🌐</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label={t('Language')}
        title={t('Language')}
        className="rounded-lg border border-[#d1d5db] bg-white px-2 py-1 text-xs font-semibold text-[#374151] shadow-sm focus:border-[#4f46e5] focus:outline-none"
      >
        <option value="tr">TR</option>
        <option value="en">EN</option>
      </select>
    </label>
  )
}
