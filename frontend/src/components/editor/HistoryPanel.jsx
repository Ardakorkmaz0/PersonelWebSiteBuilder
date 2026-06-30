import { useEffect, useState } from 'react'
import {
  listVersions,
  restoreVersion,
  createCheckpoint,
  overwriteVersion,
  deleteVersion,
} from '../../api/versions.js'

// Resident-Evil-style save slots. The History panel has two sections:
//   • Checkpoints — pinned, named saves the auto-save FIFO never evicts. You
//     create them, restore them, save OVER them, or delete them.
//   • Auto-saves — the rolling background snapshots (restore only).
// Creating/overwriting a checkpoint saves the editor first (via onSave) so the
// slot captures the latest edits, then snapshots the now-saved site.
export default function HistoryPanel({ open, siteId, onClose, onRestored, onSave }) {
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
        setErr(e?.response?.data?.detail || 'Could not load history.')
        setRows([])
      })
    return () => { cancelled = true }
  }, [open, siteId])

  const run = async (fn) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const restore = (versionId) => run(async () => {
    if (!window.confirm('Load this save? Your current state is snapshotted first, so you can undo the load.')) return
    const fresh = await restoreVersion(siteId, versionId)
    onRestored?.(fresh)
    await refresh()
  })

  const newCheckpoint = () => run(async () => {
    const count = (rows || []).filter((r) => r.pinned).length
    const name = window.prompt('Name this save', `Save ${count + 1}`)
    if (name == null) return
    await onSave?.()              // persist current edits first
    await createCheckpoint(siteId, name.trim())
    await refresh()
  })

  const overwrite = (v) => run(async () => {
    if (!window.confirm(`Save your current work over “${v.label || 'this save'}”? Its old contents are replaced.`)) return
    await onSave?.()
    await overwriteVersion(siteId, v.id)
    await refresh()
  })

  const remove = (v) => run(async () => {
    if (!window.confirm(`Delete the save “${v.label || 'this save'}”? This can't be undone.`)) return
    await deleteVersion(siteId, v.id)
    await refresh()
  })

  if (!open) return null

  const checkpoints = (rows || []).filter((r) => r.pinned)
  const autosaves = (rows || []).filter((r) => !r.pinned)

  return (
    <div
      className="fixed right-4 top-20 z-[115] flex h-[min(74vh,680px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-white shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-[#4f46e5] px-3 py-2 text-white">
        <span className="text-xs font-bold uppercase tracking-wide opacity-90">Saves &amp; history</span>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close history panel"
          className="ml-auto rounded px-2 py-0.5 text-base hover:bg-white/15"
        >
          ×
        </button>
      </div>

      <div className="border-b border-[#e5e7eb] bg-white p-3">
        <button
          type="button"
          disabled={busy}
          onClick={newCheckpoint}
          className="w-full rounded-lg bg-[#4f46e5] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:opacity-50"
        >
          + New save (checkpoint)
        </button>
        <p className="mt-1.5 text-[10px] leading-relaxed text-[#9ca3af]">
          A named save you can always come back to — kept until you delete it.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f9fafb] p-3">
        {rows === null && <p className="text-xs text-[#6b7280]">Loading…</p>}

        {rows && (
          <>
            <SectionTitle>Your saves {checkpoints.length > 0 && `(${checkpoints.length})`}</SectionTitle>
            {checkpoints.length === 0 ? (
              <p className="mb-3 rounded-md border border-dashed border-[#d1d5db] bg-white p-3 text-xs leading-relaxed text-[#6b7280]">
                No saves yet. Press <b>+ New save</b> to drop a checkpoint you can return to anytime.
              </p>
            ) : (
              <ul className="mb-4 space-y-1.5">
                {checkpoints.map((v) => (
                  <li key={v.id} className="rounded-lg border border-[#c5d4ef] bg-white p-2">
                    <div className="flex items-center gap-2">
                      <SourceBadge source="save" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#111827]">{v.label || 'Save'}</p>
                        <p className="text-[10px] text-[#6b7280]">{formatWhen(v.created_at)}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <SlotBtn disabled={busy} onClick={() => restore(v.id)}>Load</SlotBtn>
                      <SlotBtn disabled={busy} onClick={() => overwrite(v)}>Save over</SlotBtn>
                      <SlotBtn disabled={busy} danger onClick={() => remove(v)}>Delete</SlotBtn>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <SectionTitle>Auto-saves {autosaves.length > 0 && `(${autosaves.length})`}</SectionTitle>
            {autosaves.length === 0 ? (
              <p className="rounded-md border border-dashed border-[#d1d5db] bg-white p-3 text-xs leading-relaxed text-[#6b7280]">
                Auto-saves appear here as you work (the editor keeps the last 30).
              </p>
            ) : (
              <ul className="space-y-1.5">
                {autosaves.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white p-2">
                    <SourceBadge source={v.source} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-[#111827]">{v.label || labelForSource(v.source)}</p>
                      <p className="text-[10px] text-[#6b7280]">{formatWhen(v.created_at)}</p>
                    </div>
                    <SlotBtn disabled={busy} onClick={() => restore(v.id)}>Load</SlotBtn>
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

function SourceBadge({ source }) {
  const style =
    source === 'restore'
      ? 'border-[#bdaa07] bg-[#fff4ce] text-[#5d4a06]'
      : 'border-[#c5d4ef] bg-[#eef2ff] text-[#4f46e5]'
  return (
    <span
      title={`Snapshot source: ${source}`}
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${style}`}
    >
      {source}
    </span>
  )
}

function labelForSource(source) {
  return source === 'restore' ? 'Restored from history' : 'Auto-saved snapshot'
}

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}
