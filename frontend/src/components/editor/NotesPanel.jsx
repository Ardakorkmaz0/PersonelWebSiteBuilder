import { useEffect, useState } from 'react'
import { NoteIcon } from '../icons.jsx'

// Work journal: a month calendar + per-day notes ("today I did X"). Lives in
// localStorage (one journal across all sites), so it never touches the server
// and survives reloads. Days with notes get a dot in the calendar.

const KEY = 'pwb_notes'
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOWS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const loadNotes = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
const dateKey = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const todayKey = () => {
  const t = new Date()
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate())
}

export default function NotesPanel({ open, onClose }) {
  const [notes, setNotes] = useState(loadNotes)
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(todayKey)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(notes)) } catch { /* ignore */ }
  }, [notes])

  if (!open) return null

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dayNotes = notes[selected] || []

  const addNote = () => {
    const text = draft.trim()
    if (!text) return
    const t = new Date()
    const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
    setNotes((n) => ({
      ...n,
      [selected]: [...(n[selected] || []), { id: Math.random().toString(36).slice(2, 9), text, time }],
    }))
    setDraft('')
  }

  const removeNote = (noteId) => {
    setNotes((n) => {
      const rest = (n[selected] || []).filter((x) => x.id !== noteId)
      const next = { ...n }
      if (rest.length) next[selected] = rest
      else delete next[selected]
      return next
    })
  }

  return (
    <div
      className="fixed right-4 top-16 z-[120] flex max-h-[78vh] w-[340px] flex-col overflow-hidden rounded-xl border border-[#d1d5db] bg-white shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[#e5e7eb] px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-[#111827]"><NoteIcon size={15} /> Notes</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-0.5 text-sm text-[#6b7280] hover:bg-[#f3f4f6]"
        >
          ✕
        </button>
      </div>

      {/* Month calendar */}
      <div className="border-b border-[#e5e7eb] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-lg px-2 py-0.5 text-sm text-[#6b7280] hover:bg-[#f3f4f6]"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-[#111827]">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-lg px-2 py-0.5 text-sm text-[#6b7280] hover:bg-[#f3f4f6]"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {DOWS.map((d) => (
            <span key={d} className="py-0.5 text-[10px] font-semibold uppercase text-[#9ca3af]">
              {d}
            </span>
          ))}
          {Array.from({ length: startDow }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const key = dateKey(year, month, i + 1)
            const isSelected = key === selected
            const isToday = key === todayKey()
            const hasNotes = !!notes[key]?.length
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`relative rounded-lg py-1 text-xs transition ${
                  isSelected
                    ? 'bg-[#4f46e5] font-bold text-white'
                    : isToday
                      ? 'bg-[#eef2ff] font-semibold text-[#4f46e5]'
                      : 'text-[#374151] hover:bg-[#f3f4f6]'
                }`}
              >
                {i + 1}
                {hasNotes && (
                  <span
                    className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-[#4f46e5]'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Notes for the selected day */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
          {selected === todayKey() ? 'Today' : selected}
        </div>
        {dayNotes.length === 0 ? (
          <p className="text-xs text-[#9ca3af]">
            No notes for this day yet. Write what you did below.
          </p>
        ) : (
          dayNotes.map((n) => (
            <div
              key={n.id}
              className="group mb-1.5 flex items-start gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1.5"
            >
              <span className="pt-0.5 text-[10px] font-semibold text-[#9ca3af]">{n.time}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-[#374151]">{n.text}</span>
              <button
                type="button"
                onClick={() => removeNote(n.id)}
                title="Delete note"
                className="hidden rounded px-1 text-xs text-[#9ca3af] hover:text-red-600 group-hover:block"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[#e5e7eb] p-2">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNote()
            }}
            placeholder='e.g. "Finished the pricing section today"'
            className="ms-input flex-1 text-sm"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={!draft.trim()}
            className="ms-btn ms-btn-primary px-3"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
