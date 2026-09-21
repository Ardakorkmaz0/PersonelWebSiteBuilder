import { useEffect, useRef, useState } from 'react'
import { APP_FEATURES } from '../../utils/appFeatures.js'
import { FileIcon, FolderIcon, InfoIcon, UploadIcon, WarningIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

// The ⓘ beside the search: what this thing can do, in three cards.
//
// Product pages answer "what is this?" with a spec list under each headline,
// and that shape works here: a one-line promise, then the few details that
// decide whether it is for you. The animation is a staggered rise — enough to
// draw the eye down the list once, not a performance to sit through.

const ICONS = { page: FileIcon, upload: UploadIcon, folder: FolderIcon }

export default function AppInfo({ className = '' }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={t('What you can build here')}
        title={t('What you can build here')}
        className={`studio-icon-btn h-9 w-9 border ${
          open
            ? 'border-[color-mix(in_srgb,var(--studio-accent)_34%,var(--studio-border))] bg-[var(--studio-accent-soft)] text-[var(--studio-accent-text)]'
            : 'border-[var(--studio-border)] bg-[var(--studio-panel-raised)]'
        }`}
      >
        <InfoIcon size={17} />
      </button>

      {open && (
        <div className="app-info" role="dialog" aria-label={t('What you can build here')}>
          <div className="app-info-head">
            <div className="min-w-0">
              <p className="dashboard-kicker">{t('Three ways in')}</p>
              <h2 className="app-info-title">{t('What you can build here')}</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title={t('Close')}
              aria-label={t('Close')}
              className="app-info-close"
            >
              ×
            </button>
          </div>

          <ul className="app-info-list">
            {APP_FEATURES.map((feature, index) => {
              const Glyph = ICONS[feature.icon] || FileIcon
              return (
                <li
                  key={feature.id}
                  className="app-info-card"
                  style={{ '--app-info-delay': `${index * 90}ms` }}
                >
                  <div className="app-info-card-head">
                    <span className="app-info-glyph" aria-hidden="true"><Glyph size={15} /></span>
                    <div className="min-w-0">
                      <h3 className="app-info-card-title">{t(feature.title)}</h3>
                      <p className="app-info-card-summary">{t(feature.summary)}</p>
                    </div>
                  </div>

                  {/* The spec list: each line rises a beat after the one above,
                      which is what makes it read as a list rather than a wall. */}
                  <ul className="app-info-points">
                    {feature.points.map((point, pointIndex) => (
                      <li
                        key={point}
                        style={{ '--app-info-delay': `${index * 90 + 120 + pointIndex * 70}ms` }}
                      >
                        <span className="app-info-dot" aria-hidden="true" />
                        {t(point)}
                      </li>
                    ))}
                  </ul>

                  {feature.caveat && (
                    <p
                      className="app-info-caveat"
                      style={{ '--app-info-delay': `${index * 90 + 120 + feature.points.length * 70}ms` }}
                    >
                      <WarningIcon size={13} className="mt-[1px] shrink-0" />
                      <span>{t(feature.caveat)}</span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
