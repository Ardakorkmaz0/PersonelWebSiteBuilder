import { useEffect, useState } from 'react'
import {
  listVersions,
  restoreVersion,
  createCheckpoint,
  overwriteVersion,
  setVersionPinned,
  deleteVersion,
} from '../../api/versions.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { groupSiteVersions } from '../../utils/versionGroups.js'
import { ClockIcon, PlusIcon } from '../icons.jsx'

// Resident-Evil-style save slots. The History panel has two sections:
//   • Checkpoints — pinned, named saves the auto-save FIFO never evicts. You
//     create them, restore them, save OVER them, or delete them.
//   • Auto-saves — the rolling background snapshots (restore only).
// Creating/overwriting a checkpoint saves the editor first (via onSave) so the
// slot captures the latest edits, then snapshots the now-saved site.
export default function HistoryPanel({
  open,
  siteId,
  onClose,
  onRestored,
  onSave,
  autoSaveEnabled = false,
  onAutoSaveEnabled,
}) {
  const { t, language } = useLanguage()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')

  const refresh = async () => {
    const next = await listVersions(siteId)
    setRows(Array.isArray(next) ? next : [])
  }

  useEffect(() => {
    if (!open || !siteId) return undefined
    let cancelled = false
    listVersions(siteId)
      .then((data) => { if (!cancelled) setRows(Array.isArray(data) ? data : []) })
      .catch((e) => {
        if (cancelled) return
        setErr(e?.response?.data?.detail || t('Could not load history.'))
        setRows([])
      })
    return () => { cancelled = true }
  }, [open, siteId, t])

  const run = async (fn) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || t('Something went wrong.'))
    } finally {
      setBusy(false)
    }
  }

  const restore = (versionId) => run(async () => {
    if (!window.confirm(t('Load this save? Your current state is snapshotted first, so you can undo the load.'))) return
    const fresh = await restoreVersion(siteId, versionId)
    onRestored?.(fresh)
    await refresh()
  })

  const newCheckpoint = () => run(async () => {
    const count = (rows || []).filter((r) => r.pinned).length
    const name = window.prompt(t('Name this save'), t('Save {count}', { count: count + 1 }))
    if (name == null) return
    const saved = await onSave?.({ versionSource: 'checkpoint' })
    if (!saved) throw new Error(t('Save failed. The checkpoint was not created.'))
    await createCheckpoint(siteId, name.trim())
    await refresh()
  })

  const overwrite = (v) => run(async () => {
    if (!window.confirm(t('Save your current work over “{name}”? Its old contents are replaced.', { name: v.label || t('this save') }))) return
    const saved = await onSave?.({ versionSource: 'checkpoint' })
    if (!saved) throw new Error(t('Save failed. The checkpoint was not changed.'))
    await overwriteVersion(siteId, v.id)
    await refresh()
  })

  const remove = (v) => run(async () => {
    if (!window.confirm(t('Delete the save “{name}”? This cannot be undone.', { name: v.label || t('this save') }))) return
    await deleteVersion(siteId, v.id)
    await refresh()
  })

  const togglePin = (v) => run(async () => {
    await setVersionPinned(siteId, v.id, !v.pinned)
    await refresh()
  })

  if (!open) return null

  const { manualSaves, autosaves, recoverySaves } = groupSiteVersions(rows)

  return (
    <aside
      aria-label={t('Saves & history')}
      className="studio-theme-surface fixed right-2 top-[60px] z-[115] flex h-[calc(100vh-68px)] max-h-[720px] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] sm:right-4 sm:top-[68px] sm:h-[calc(100vh-84px)] sm:w-[440px]"
      style={{ boxShadow: 'var(--studio-shadow-menu)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex min-h-[60px] items-center gap-2.5 border-b border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]">
          <ClockIcon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-[var(--studio-text)]">{t('Saves & history')}</span>
          <span className="block truncate text-[10px] text-[var(--studio-text-muted)]">{t('Return to an earlier version without losing your current work.')}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title={t('Close')}
          aria-label={t('Close history panel')}
          className="studio-icon-btn h-7 w-7 shrink-0 text-lg"
        >
          ×
        </button>
      </div>

      <div className="border-b border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
        <div className="flex items-stretch gap-2">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-control)] px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-[var(--studio-text)]">{t('Automatic saving')}</span>
              <span className="block truncate text-[9px] text-[var(--studio-text-muted)]">
                {autoSaveEnabled ? t('Changes save automatically') : t('Manual save only')}
              </span>
            </span>
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => onAutoSaveEnabled?.(e.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`relative h-5 w-9 shrink-0 rounded-full border transition ${
                autoSaveEnabled
                  ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)]'
                  : 'border-[var(--studio-border-strong)] bg-[var(--studio-panel-raised)]'
              }`}
            >
              <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition ${autoSaveEnabled ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
          </label>
        <button
          type="button"
          disabled={busy}
          onClick={newCheckpoint}
          className="studio-btn studio-btn-primary shrink-0 justify-center px-3 disabled:opacity-50"
        >
          <PlusIcon size={14} /> {t('New named save')}
        </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2">
        {[
          ['all', 'All', (rows || []).length],
          ['manual', 'Manual', manualSaves.length],
          ['auto', 'Automatic', autosaves.length],
          ['recovery', 'Recovery', recoverySaves.length],
        ].map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-label={`${t(label)} ${count}`}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-semibold transition ${
              filter === value
                ? 'bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]'
                : 'text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
            }`}
          >
            <span className="truncate">{t(label)}</span>
            <span className="rounded-full bg-[var(--studio-control)] px-1.5 py-0.5 text-[8px] opacity-80">{count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-[var(--studio-shell)] p-3">
        {rows === null && <p className="text-xs text-[var(--studio-text-muted)]">{t('Loading…')}</p>}

        {rows && (
          <>
            {(filter === 'all' || filter === 'manual') && (
            <>
            <SectionTitle>{t('Manual saves')} {manualSaves.length > 0 && `(${manualSaves.length})`}</SectionTitle>
            {manualSaves.length === 0 ? (
              <p className="mb-3 rounded-md border border-dashed border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 text-xs leading-relaxed text-[var(--studio-text-muted)]">
                {t('Manual saves appear here when you press Save or create a named checkpoint.')}
              </p>
            ) : (
              <ul className="mb-4 space-y-2">
                {manualSaves.map((v) => (
                  <li key={v.id} className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 transition hover:border-[var(--studio-border-strong)]">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={v.source} pinned={v.pinned} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[var(--studio-text)]">{v.label || t('Manual save')}</p>
                        <p className="text-[10px] text-[var(--studio-text-muted)]">{formatWhen(v.created_at, language)}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap justify-end gap-1.5 border-t border-[var(--studio-border)] pt-2">
                      <SlotBtn disabled={busy} onClick={() => restore(v.id)}>{t('Load')}</SlotBtn>
                      {v.pinned && <SlotBtn disabled={busy} onClick={() => overwrite(v)}>{t('Save over')}</SlotBtn>}
                      <SlotBtn disabled={busy} onClick={() => togglePin(v)}>{v.pinned ? t('Unpin') : t('Pin')}</SlotBtn>
                      <SlotBtn disabled={busy} danger onClick={() => remove(v)}>{t('Delete')}</SlotBtn>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </>
            )}

            {(filter === 'all' || filter === 'auto') && (
            <>
            <SectionTitle>{t('Auto-saves')} {autosaves.length > 0 && `(${autosaves.length})`}</SectionTitle>
            {autosaves.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 text-xs leading-relaxed text-[var(--studio-text-muted)]">
                {t('Auto-saves appear here as you work (the editor keeps the last 30).')}
              </p>
            ) : (
              <ul className="space-y-2">
                {autosaves.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 transition hover:border-[var(--studio-border-strong)]">
                    <SourceBadge source={v.source} pinned={v.pinned} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-[var(--studio-text)]">{v.label || labelForSource(v.source, t)}</p>
                      <p className="text-[10px] text-[var(--studio-text-muted)]">{formatWhen(v.created_at, language)}</p>
                    </div>
                    <SlotBtn disabled={busy} onClick={() => togglePin(v)}>{v.pinned ? t('Unpin') : t('Pin')}</SlotBtn>
                    <SlotBtn disabled={busy} onClick={() => restore(v.id)}>{t('Load')}</SlotBtn>
                  </li>
                ))}
              </ul>
            )}
            </>
            )}

            {(filter === 'all' || filter === 'recovery') && recoverySaves.length > 0 && (
              <>
                <SectionTitle>{t('Recovery points')} ({recoverySaves.length})</SectionTitle>
                <ul className="space-y-2">
                  {recoverySaves.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 transition hover:border-[var(--studio-border-strong)]">
                      <SourceBadge source={v.source} pinned={v.pinned} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-[var(--studio-text)]">{v.label || labelForSource(v.source, t)}</p>
                        <p className="text-[10px] text-[var(--studio-text-muted)]">{formatWhen(v.created_at, language)}</p>
                      </div>
                      <SlotBtn disabled={busy} onClick={() => restore(v.id)}>{t('Load')}</SlotBtn>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {filter === 'recovery' && recoverySaves.length === 0 && (
              <p className="rounded-xl border border-dashed border-[var(--studio-border)] bg-[var(--studio-panel)] p-4 text-xs leading-relaxed text-[var(--studio-text-muted)]">
                {t('Recovery points appear here when you restore an older save.')}
              </p>
            )}
          </>
        )}

        {err && (
          <div
            className="mt-2 rounded-lg border p-2 text-xs text-[var(--studio-danger)]"
            style={{
              borderColor: 'color-mix(in srgb, var(--studio-danger) 35%, transparent)',
              background: 'color-mix(in srgb, var(--studio-danger) 8%, var(--studio-panel))',
            }}
          >{err}</div>
        )}
      </div>
    </aside>
  )
}

function SectionTitle({ children }) {
  return <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--studio-text-faint)]">{children}</div>
}

function SlotBtn({ children, onClick, disabled, danger }) {
  const dangerStyle = danger
    ? {
        borderColor: 'color-mix(in srgb, var(--studio-danger) 34%, var(--studio-border))',
        background: 'color-mix(in srgb, var(--studio-danger) 7%, var(--studio-panel))',
      }
    : undefined
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={dangerStyle}
      className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${
        danger
          ? 'text-[var(--studio-danger)] hover:brightness-110'
          : 'border-[var(--studio-border)] bg-[var(--studio-control)] text-[var(--studio-text-muted)] hover:border-[var(--studio-border-strong)] hover:text-[var(--studio-text)]'
      }`}
    >
      {children}
    </button>
  )
}

function SourceBadge({ source, pinned = false }) {
  const { t } = useLanguage()
  const style =
    source === 'restore'
      ? 'border-[var(--studio-warning)] bg-[var(--studio-warning-soft)] text-[var(--studio-warning)]'
      : 'border-[var(--studio-border)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]'
  return (
    <span
      title={t('Snapshot source: {source}', { source: t(source) })}
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${style}`}
    >
      {pinned ? '★ ' : ''}{t(source)}
    </span>
  )
}

function labelForSource(source, translate) {
  if (source === 'restore') return translate('Restored from history')
  if (source === 'save') return translate('Older saved snapshot')
  return translate('Auto-saved snapshot')
}

function formatWhen(iso, language) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}
