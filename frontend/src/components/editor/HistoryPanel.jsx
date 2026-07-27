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
    <>
    <aside
      aria-label={t('Saves & history')}
      className="studio-theme-surface fixed bottom-0 right-0 top-[52px] z-[115] flex w-[min(100vw,440px)] flex-col overflow-hidden border-l border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex min-h-[64px] items-center gap-3 border-b border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]">
          <ClockIcon size={17} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--studio-text)]">{t('Saves & history')}</span>
          <span className="block text-[10px] text-[var(--studio-text-muted)]">{t('Return to an earlier version without losing your current work.')}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title={t('Close')}
          aria-label={t('Close history panel')}
          className="ml-auto rounded-lg px-2 py-1 text-lg text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]"
        >
          ×
        </button>
      </div>

      <div className="border-b border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-control)] px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-[var(--studio-text)]">{t('Automatic saving')}</span>
          <span className="block text-[10px] leading-relaxed text-[var(--studio-text-muted)]">
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
      </div>

      <div className="border-b border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 pb-3">
        <button
          type="button"
          disabled={busy}
          onClick={newCheckpoint}
          className="studio-btn studio-btn-primary w-full justify-center py-2 disabled:opacity-50"
        >
          <PlusIcon size={14} /> {t('New named save')}
        </button>
        <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--studio-text-faint)]">
          {t('A named save you can always come back to — kept until you delete it.')}
        </p>
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
            className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
              filter === value
                ? 'bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]'
                : 'text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
            }`}
          >
            <span className="block truncate">{t(label)}</span>
            <span className="text-[9px] opacity-70">{count}</span>
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
            </>
            )}

            {(filter === 'all' || filter === 'recovery') && recoverySaves.length > 0 && (
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
    <button
      type="button"
      aria-label={t('Close history panel')}
      onClick={onClose}
      className="fixed inset-0 z-[114] cursor-default bg-black/20"
    />
    </>
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
