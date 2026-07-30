// Compact inspector navigation. The raised active item reads like a modern
// segmented control without stealing the vertical space of the old icon-over-
// label tabs. Keyboard arrows keep the narrow panel easy to navigate too.
export default function PanelTabs({ value, onChange, tabs }) {
  const moveFocus = (event, index) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    onChange(tabs[nextIndex][0])
    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus()
  }

  return (
    <div
      role="tablist"
      className="mx-3 my-2 flex min-w-0 gap-1 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-control)] p-1"
    >
      {tabs.map(([id, label], index) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => moveFocus(event, index)}
            title={label}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-lg px-1 py-1.5 text-[10px] font-semibold transition ${
              active
                ? 'bg-[var(--studio-panel-raised)] text-[var(--studio-accent-text)] shadow-[var(--studio-shadow-sm)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--studio-accent)_18%,var(--studio-border))]'
                : 'text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
            }`}
          >
            <span className="whitespace-nowrap">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
