import { useLanguage } from '../i18n/useLanguage.js'
import { GlobeIcon, MonitorIcon, MoonIcon, SunIcon } from './icons.jsx'
import { useUiTheme } from '../ui/useUiTheme.js'

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, t } = useLanguage()
  const { preference, setPreference } = useUiTheme()
  const themes = {
    light: ['Light', SunIcon],
    dark: ['Dark', MoonIcon],
    system: ['System', MonitorIcon],
  }
  const [themeLabel, ThemeIcon] = themes[preference] || themes.dark
  const cycleTheme = () => {
    setPreference(preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light')
  }
  return (
    <div className={`studio-utility-switcher ${className}`}>
      <button
        type="button"
        onClick={cycleTheme}
        aria-label={`${t('Appearance')}: ${t(themeLabel)}`}
        title={`${t('Appearance')}: ${t(themeLabel)}`}
        className="studio-utility-button"
      >
        <ThemeIcon size={14} />
      </button>
      <span className="studio-utility-divider" aria-hidden />
      <label className="studio-language-control">
        <span className="sr-only">{t('Language')}</span>
        <GlobeIcon size={13} className="text-[var(--studio-text-faint)]" />
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          aria-label={t('Language')}
          title={t('Language')}
          className="studio-language-select"
        >
          <option value="tr">TR</option>
          <option value="en">EN</option>
        </select>
      </label>
    </div>
  )
}
