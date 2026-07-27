// The Properties panel's four sections. A full-width bar rather than the pill
// SegmentedToggle: at the panel's 288px there is no room for four pills, and
// these are navigation, not a two-way switch.
export default function PanelTabs({ value, onChange, tabs }) {
  return (
    <div role="tablist" className="flex border-b border-[var(--studio-border,#e5e7eb)]">
      {tabs.map(([id, label, Icon]) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            title={label}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
              active
                ? 'border-b-2 border-[var(--studio-accent,#4f46e5)] text-[var(--studio-accent-hover,#4338ca)]'
                : 'border-b-2 border-transparent text-[var(--studio-text-muted,#6b7280)] hover:text-[var(--studio-text,#374151)]'
            }`}
          >
            <Icon size={15} />
            <span className="max-w-full truncate px-0.5">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
