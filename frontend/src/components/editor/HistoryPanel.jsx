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

  const manualSaves = (rows || []).filter((r) => r.source === 'manual')
  const autosaves = (rows || []).filter((r) => r.source !== 'manual')

  return (
    <div
      className="fixed right-4 top-20 z-[115] flex h-[min(74vh,680px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-white shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-[#4f46e5] px-3 py-2 text-white">
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

      <label className="flex cursor-pointer items-center gap-3 border-b border-[#e5e7eb] bg-[#eef2ff] px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-[#312e81]">{t('Automatic saving')}</span>
          <span className="block text-[10px] leading-relaxed text-[#6366f1]">
            {autoSaveEnabled
              ? t('On: changes are saved after a short pause.')
              : t('Off: only the Save button creates a save.')}
          </span>
        </span>
        <input
          type="checkbox"
          checked={autoSaveEnabled}
          onChange={(e) => onAutoSaveEnabled?.(e.target.checked)}
          className="h-4 w-4 accent-[#4f46e5]"
        />
        <span className="w-7 text-right text-[10px] font-bold uppercase text-[#4338ca]">
          {autoSaveEnabled ? t('On') : t('Off')}
        </span>
      </label>

      <div className="border-b border-[#e5e7eb] bg-white p-3">
        <button
          type="button"
          disabled={busy}
          onClick={newCheckpoint}
          className="w-full rounded-lg bg-[#4f46e5] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:opacity-50"
        >
          {t('+ New save (checkpoint)')}
        </button>
        <p className="mt-1.5 text-[10px] leading-relaxed text-[#9ca3af]">
          {t('A named save you can always come back to — kept until you delete it.')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f9fafb] p-3">
        {rows === null && <p className="text-xs text-[#6b7280]">{t('Loading…')}</p>}

        {rows && (
          <>
            <SectionTitle>{t('Manual saves')} {manualSaves.length > 0 && `(${manualSaves.length})`}</SectionTitle>
            {manualSaves.length === 0 ? (
              <p className="mb-3 rounded-md border border-dashed border-[#d1d5db] bg-white p-3 text-xs leading-relaxed text-[#6b7280]">
                {t('Manual saves appear here when you press Save or create a named checkpoint.')}
              </p>
            ) : (
              <ul className="mb-4 space-y-1.5">
                {manualSaves.map((v) => (
                  <li key={v.id} className="rounded-lg border border-[#c5d4ef] bg-white p-2">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={v.source} pinned={v.pinned} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#111827]">{v.label || t('Manual save')}</p>
                        <p className="text-[10px] text-[#6b7280]">{formatWhen(v.created_at, language)}</p>
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
              <p className="rounded-md border border-dashed border-[#d1d5db] bg-white p-3 text-xs leading-relaxed text-[#6b7280]">
                {t('Auto-saves appear here as you work (the editor keeps the last 30).')}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {autosaves.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white p-2">
                    <SourceBadge source={v.source} pinned={v.pinned} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-[#111827]">{v.label || labelForSource(v.source, t)}</p>
                      <p className="text-[10px] text-[#6b7280]">{formatWhen(v.created_at, language)}</p>
                    </div>
                    <SlotBtn disabled={busy} onClick={() => togglePin(v)}>{v.pinned ? t('Unpin') : t('Pin')}</SlotBtn>
                    <SlotBtn disabled={busy} onClick={() => restore(v.id)}>{t('Load')}</SlotBtn>
                  </li>
                ))}
              </ul>
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
  return <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{children}</div>
}

function SlotBtn({ children, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium disabled:opacity-50 ${
        danger
          ? 'border-red-200 text-[#b91c1c] hover:bg-red-50'
          : 'border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6]'
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
      ? 'border-[#bdaa07] bg-[#fff4ce] text-[#5d4a06]'
      : 'border-[#c5d4ef] bg-[#eef2ff] text-[#4f46e5]'
  return (
    <span
      title={t('Snapshot source: {source}', { source: t(source) })}
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${style}`}
    >
      {pinned ? '★ ' : ''}{t(source)}
    </span>
  )
}

function labelForSource(source, t) {
  if (source === 'restore') return t('Restored from history')
  if (source === 'save') return t('Older saved snapshot')
  return t('Auto-saved snapshot')
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
