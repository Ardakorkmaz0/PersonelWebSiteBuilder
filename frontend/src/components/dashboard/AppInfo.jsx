import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { APP_FEATURES } from '../../utils/appFeatures.js'
import { CheckIcon, FileIcon, FolderIcon, InfoIcon, UploadIcon, WarningIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'
import { useDialogMotion } from '../../ui/useDialogMotion.js'

const ICONS = { page: FileIcon, upload: UploadIcon, folder: FolderIcon }

export default function AppInfo({ className = '' }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState(null)
  const id = useId()
  const { dialogRef, backdropRef, requestClose, onKeyDown } = useDialogMotion({
    open, origin, onClose: () => setOpen(false),
  })

  function showGuide(event) {
    const trigger = event.currentTarget
    const { left, top, width, height } = trigger.getBoundingClientRect()
    setOrigin({ left, top, width, height, trigger })
    setOpen(true)
  }

  return (
    <div className={`shrink-0 ${className}`}>
      <button type="button" onClick={showGuide} aria-haspopup="dialog" aria-expanded={open}
        aria-controls={open ? id : undefined} title={t('What you can build here')}
        className="app-info-trigger">
        <InfoIcon size={18} />
        <span>{t('Quick guide')}</span>
      </button>

      {open && createPortal(
        <div ref={backdropRef} className="app-info-backdrop" onKeyDown={onKeyDown}
          onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose() }}>
          <section ref={dialogRef} id={id} className="app-info" role="dialog" aria-modal="true"
            aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} tabIndex={-1}>
            <div className="app-info-head">
              <div>
                <p className="dashboard-kicker">{t('Three ways in')}</p>
                <h2 id={`${id}-title`} className="app-info-title">{t('Your website starts here')}</h2>
                <p id={`${id}-description`} className="app-info-description">{t('Start fresh, bring an HTML page, or open a project on your computer.')}</p>
              </div>
              <button type="button" onClick={requestClose} aria-label={t('Close')} className="app-info-close">×</button>
            </div>

            <ul className="app-info-list">
              {APP_FEATURES.map((feature, index) => {
                const Glyph = ICONS[feature.icon] || FileIcon
                return (
                  <li key={feature.id} className="app-info-card" data-tone={feature.tone}
                    style={{ '--app-info-delay': `${index * 65}ms` }}>
                    <div className="app-info-card-top">
                      <span className="app-info-glyph" aria-hidden="true"><Glyph size={27} /></span>
                      <span className="app-info-tag">{t(feature.tag)}</span>
                    </div>
                    <h3 className="app-info-card-title">{t(feature.title)}</h3>
                    <p className="app-info-card-summary">{t(feature.summary)}</p>
                    <ul className="app-info-points">
                      {feature.points.map((point) => (
                        <li key={point}><CheckIcon size={16} className="app-info-check" aria-hidden="true" /><span>{t(point)}</span></li>
                      ))}
                    </ul>
                    {feature.caveat && <p className="app-info-caveat"><WarningIcon size={16} aria-hidden="true" /><span>{t(feature.caveat)}</span></p>}
                  </li>
                )
              })}
            </ul>

            <div className="app-info-footer">
              <p>{t('Use New site or Open local project on the home page to get started.')}</p>
              <button type="button" onClick={requestClose} className="studio-btn studio-btn-primary">{t('Got it')}</button>
            </div>
          </section>
        </div>, document.body,
      )}
    </div>
  )
}
