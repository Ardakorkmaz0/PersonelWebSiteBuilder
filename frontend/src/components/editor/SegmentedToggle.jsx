// A soft, warm segmented control in the spirit of Claude's UI: a paper-toned
// track with the active option lifted onto a white pill (soft shadow + a
// hairline ring) instead of a flat colored block. Shared by the Properties and
// HTML element panels so the Basic / Extend switch reads the same everywhere.
export default function SegmentedToggle({ value, onChange, options, className = '' }) {
  return (
    <div
      role="tablist"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-[10px] bg-[#eae7e0] p-0.5 ${className}`}
    >
      {options.map(([val, label]) => {
        const active = value === val
        return (
          <button
            key={val}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(val)}
            className={`rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 ${
              active
                ? 'bg-white text-[#1a1a18] shadow-[0_1px_2px_rgba(40,33,20,0.14)] ring-1 ring-[#1a1a18]/[0.05]'
                : 'text-[#76736b] hover:text-[#1a1a18]'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
