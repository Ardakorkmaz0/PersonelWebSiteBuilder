import { useState } from 'react'
import { ChevronDownIcon } from '../icons.jsx'

const OPEN_KEY = 'pwb_props_groups'

// Which groups the user left open, so a group they opened stays open on the next
// selection and after a reload. Stored as one map rather than a key per group.
function readOpenMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeOpen(id, open) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpenMap(), [id]: open }))
  } catch {
    /* private mode — remembering is a nicety, not required */
  }
}

// One collapsible group inside a Properties tab. `id` keys the remembered
// open/closed state; `defaultOpen` decides the FIRST time only, so the everyday
// groups start expanded and the rarely-used ones start out of the way.
export default function PanelGroup({ id, title, defaultOpen = false, aside = null, children }) {
  const [open, setOpen] = useState(() => {
    const saved = readOpenMap()[id]
    return typeof saved === 'boolean' ? saved : defaultOpen
  })
  const toggle = () => {
    const next = !open
    setOpen(next)
    writeOpen(id, next)
  }
  return (
    <section className="border-b border-[var(--studio-border,#e5e7eb)] pb-3 last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 py-2 text-left"
      >
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-[var(--studio-text-muted,#6b7280)]">
          {title}
          {aside}
        </span>
        <ChevronDownIcon
          size={14}
          className={`shrink-0 text-[var(--studio-text-faint,#9ca3af)] transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="space-y-3 pt-1">{children}</div>}
    </section>
  )
}
