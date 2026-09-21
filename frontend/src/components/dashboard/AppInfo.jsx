import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { APP_FEATURES } from '../../utils/appFeatures.js'
import { FolderArt, ScratchArt, UploadArt } from './GuideArt.jsx'
import { ArrowRightIcon, InfoIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'
import { useDialogMotion } from '../../ui/useDialogMotion.js'

// The drawing that belongs with each path.
const ART = { page: ScratchArt, upload: UploadArt, folder: FolderArt }

// The starting guide: three ways into the app, read top to bottom.
//
// Not three boxed cards with tick lists — that is the shape every landing page
// generator reaches for, and it makes a product look like a template. This is
// laid out like a contents page instead: a numeral, a line that says what the
// path is, the details on one line under it, and a drawing of the thing itself
// on the right. The numeral column is also the hover affordance, so the whole
// row lights up as one object.

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
      <button
        type="button"
        onClick={showGuide}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={t('What you can build here')}
        className="app-info-trigger"
      >
        <InfoIcon size={18} />
        <span>{t('Quick guide')}</span>
      </button>

      {open && createPortal(
        <div
          ref={backdropRef}
          className="app-info-backdrop"
          onKeyDown={onKeyDown}
          onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose() }}
        >
          <section
            ref={dialogRef}
            id={id}
            className="app-info"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-description`}
            tabIndex={-1}
          >
            <div className="app-info-head">
              <div className="min-w-0">
                <p className="app-info-eyebrow">{t('Three ways in')}</p>
                <h2 id={`${id}-title`} className="app-info-title">{t('Your website starts here')}</h2>
                <p id={`${id}-description`} className="app-info-description">
                  {t('Start fresh, bring an HTML page, or open a project on your computer.')}
                </p>
              </div>
              <button type="button" onClick={requestClose} aria-label={t('Close')} className="app-info-close">×</button>
            </div>

            <ol className="app-info-list">
              {APP_FEATURES.map((feature, index) => {
                const Art = ART[feature.icon] || ScratchArt
                return (
                  <li
                    key={feature.id}
                    className="app-info-row"
                    data-tone={feature.tone}
                    style={{ '--app-info-delay': `${index * 70}ms` }}
                  >
                    <span className="app-info-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <div className="app-info-body">
                      <p className="app-info-tag">{t(feature.tag)}</p>
                      <h3 className="app-info-card-title">{t(feature.title)}</h3>
                      <p className="app-info-card-summary">{t(feature.summary)}</p>
                      {/* One line, separated by rules: a vertical tick list next
                          to a drawing is exactly the template look this replaces. */}
                      <ul className="app-info-points">
                        {feature.points.map((point) => <li key={point}>{t(point)}</li>)}
                      </ul>
                      {feature.caveat && (
                        <p className="app-info-caveat">{t(feature.caveat)}</p>
                      )}
                    </div>
                    <span className="app-info-art" aria-hidden="true"><Art /></span>
                  </li>
                )
              })}
            </ol>

            <div className="app-info-footer">
              <p>{t('Use New site or Open local project on the home page to get started.')}</p>
              <button type="button" onClick={requestClose} className="studio-btn studio-btn-primary">
                {t('Got it')} <ArrowRightIcon size={15} />
              </button>
            </div>
          </section>
        </div>, document.body,
      )}
    </div>
  )
}
