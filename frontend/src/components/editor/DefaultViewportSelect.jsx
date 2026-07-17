import { useLanguage } from '../../i18n/useLanguage.js'

export default function DefaultViewportSelect({ value, onChange }) {
  const { t } = useLanguage()
  return (
    <select
      value={value === 'mobile' ? 'mobile' : 'pc'}
      onChange={(event) => onChange(event.target.value)}
      aria-label={t('Editor opening screen')}
      title={t('Editor opening screen')}
      className="studio-input w-[118px] shrink-0 px-2 py-1.5 text-xs font-medium"
    >
      <option value="pc">{t('Opening: PC')}</option>
      <option value="mobile">{t('Opening: Mobile')}</option>
    </select>
  )
}
