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
    <div className={`flex shrink-0 items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={cycleTheme}
        aria-label={`${t('Appearance')}: ${t(themeLabel)}`}
        title={`${t('Appearance')}: ${t(themeLabel)}`}
        className="studio-icon-btn border border-[var(--studio-border)] bg-[var(--studio-panel-raised)]"
      >
        <ThemeIcon size={14} />
      </button>
      <label className="flex shrink-0 items-center gap-1.5">
        <span className="sr-only">{t('Language')}</span>
        <GlobeIcon size={14} className="text-[var(--studio-text-muted)]" />
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          aria-label={t('Language')}
          title={t('Language')}
          className="studio-input px-2 py-1 text-xs font-semibold shadow-sm"
        >
          <option value="tr">TR</option>
          <option value="en">EN</option>
        </select>
      </label>
    </div>
  )
}
