import { useEffect, useState } from 'react'
import { listVersions, restoreVersion } from '../../api/versions.js'

// Floating side panel that lists the site's saved snapshots (newest first)
// and lets the user roll back to any one with a single click. Mounts only
// when the History button is toggled — fetches the list on mount, refetches
// after a restore, and refuses the destructive action without a confirm.
//
// The panel never displays the full schema bytes — only timestamp + label +
// source — so a long history doesn't bloat the panel state. The "Restore"
// call returns the full updated site, which the parent reloads into the
// editor store via the onRestored callback.
export default function HistoryPanel({ open, siteId, onClose, onRestored }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !siteId) return undefined
    // No state reset here: the panel is mounted fresh each time the History
    // button opens it, so rows/err already start at their initial values.
    let cancelled = false
    listVersions(siteId)
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : [])
      })
      .catch((e) => {
        if (cancelled) return
        setErr(e?.response?.data?.detail || 'Could not load history.')
        setRows([])
      })
    return () => { cancelled = true }
  }, [open, siteId])

  async function restore(versionId) {
    if (busy) return
    if (
      !window.confirm(
        'Roll back to this version? A snapshot of the current state is saved first so you can undo this restore.',
      )
    ) {
      return
    }
    setBusy(true)
    setErr('')
    try {
      const fresh = await restoreVersion(siteId, versionId)
      onRestored?.(fresh)
      // Refresh the list so the new "restore" checkpoint row appears.
      const next = await listVersions(siteId)
      setRows(Array.isArray(next) ? next : [])
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Restore failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed right-4 top-20 z-[115] flex h-[min(70vh,640px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-white shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-[#4f46e5] px-3 py-2 text-white">
        <span className="text-xs font-bold uppercase tracking-wide opacity-90">History</span>
        <span className="ml-1 truncate rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
          {rows?.length ?? '–'} versions
        </span>
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

      <div className="flex-1 overflow-y-auto bg-[#f9fafb] p-3">
        {rows === null && (
          <p className="text-xs text-[#6b7280]">Loading history…</p>
        )}
        {rows && rows.length === 0 && (
          <p className="rounded-md border border-dashed border-[#d1d5db] bg-white p-3 text-xs leading-relaxed text-[#6b7280]">
            No history yet. The next Save (or any AI change) will start your
            timeline — the editor keeps the last 30 snapshots automatically.
          </p>
        )}
        {rows && rows.length > 0 && (
          <ul className="space-y-1.5">
            {rows.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white p-2"
              >
                <SourceBadge source={v.source} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-[#111827]">
                    {v.label || labelForSource(v.source)}
                  </p>
                  <p className="text-[10px] text-[#6b7280]">{formatWhen(v.created_at)}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => restore(v.id)}
                  className="rounded-lg border border-[#d1d5db] bg-white px-2 py-0.5 text-[11px] font-medium text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
        {err && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            {err}
          </div>
        )}
      </div>
    </div>
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
  return source === 'restore' ? 'Restored from history' : 'Saved snapshot'
}

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
