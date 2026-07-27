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
    <div
      className="studio-theme-surface fixed right-4 top-20 z-[115] flex h-[min(74vh,680px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-[var(--studio-border)] bg-[var(--studio-accent)] px-3 py-2 text-white">
        <span className="text-xs font-bold uppercase tracking-wide opacity-90">{t('Saves & history')}</span>
        <button
          type="button"
          onClick={onClose}
          title={t('Close')}
          aria-label={t('Close history panel')}
          className="ml-auto rounded px-2 py-0.5 text-base hover:bg-white/15"
        >
          ×
        </button>
      </div>

      <label className="flex cursor-pointer items-center gap-3 border-b border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-[var(--studio-text)]">{t('Automatic saving')}</span>
          <span className="block text-[10px] leading-relaxed text-[var(--studio-accent-hover)]">
            {autoSaveEnabled
              ? t('On: changes are saved after a short pause.')
              : t('Off: only the Save button creates a save.')}
          </span>
        </span>
        <input
          type="checkbox"
          checked={autoSaveEnabled}
          onChange={(e) => onAutoSaveEnabled?.(e.target.checked)}
          className="h-4 w-4 accent-[var(--studio-accent)]"
        />
        <span className="w-7 text-right text-[10px] font-bold uppercase text-[var(--studio-accent-hover)]">
          {autoSaveEnabled ? t('On') : t('Off')}
        </span>
      </label>

      <div className="border-b border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
        <button
          type="button"
          disabled={busy}
          onClick={newCheckpoint}
          className="w-full rounded-lg bg-[var(--studio-accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--studio-accent-pressed)] disabled:opacity-50"
        >
          {t('+ New save (checkpoint)')}
        </button>
        <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--studio-text-faint)]">
          {t('A named save you can always come back to — kept until you delete it.')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto bg-[var(--studio-control)] p-3">
        {rows === null && <p className="text-xs text-[var(--studio-text-muted)]">{t('Loading…')}</p>}

        {rows && (
          <>
            <SectionTitle>{t('Manual saves')} {manualSaves.length > 0 && `(${manualSaves.length})`}</SectionTitle>
            {manualSaves.length === 0 ? (
              <p className="mb-3 rounded-md border border-dashed border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 text-xs leading-relaxed text-[var(--studio-text-muted)]">
                {t('Manual saves appear here when you press Save or create a named checkpoint.')}
              </p>
            ) : (
              <ul className="mb-4 space-y-1.5">
                {manualSaves.map((v) => (
                  <li key={v.id} className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={v.source} pinned={v.pinned} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[var(--studio-text)]">{v.label || t('Manual save')}</p>
                        <p className="text-[10px] text-[var(--studio-text-muted)]">{formatWhen(v.created_at, language)}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <SlotBtn disabled={busy} onClick={() => restore(v.id)}>{t('Load')}</SlotBtn>
                      {v.pinned && <SlotBtn disabled={busy} onClick={() => overwrite(v)}>{t('Save over')}</SlotBtn>}
                      <SlotBtn disabled={busy} onClick={() => togglePin(v)}>{v.pinned ? t('Unpin') : t('Pin')}</SlotBtn>
                      <SlotBtn disabled={busy} danger onClick={() => remove(v)}>{t('Delete')}</SlotBtn>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <SectionTitle>{t('Auto-saves')} {autosaves.length > 0 && `(${autosaves.length})`}</SectionTitle>
            {autosaves.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 text-xs leading-relaxed text-[var(--studio-text-muted)]">
                {t('Auto-saves appear here as you work (the editor keeps the last 30).')}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {autosaves.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2">
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

            {recoverySaves.length > 0 && (
              <>
                <SectionTitle>{t('Recovery points')} ({recoverySaves.length})</SectionTitle>
                <ul className="space-y-1.5">
                  {recoverySaves.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2">
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
          </>
        )}

        {err && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{err}</div>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--studio-text-faint)]">{children}</div>
}

function SlotBtn({ children, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50 ${
        danger
          ? 'border-red-200 text-[var(--studio-danger)] hover:bg-red-50'
          : 'border-[var(--studio-border)] text-[var(--studio-text)] hover:bg-[var(--studio-control)]'
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
