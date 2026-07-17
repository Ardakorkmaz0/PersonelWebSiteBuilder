import { SearchIcon } from '../icons.jsx'

export default function DashboardSearch({ value, onChange, label, placeholder, className = '' }) {
  return (
    <label className={`dashboard-search ${className}`}>
      <SearchIcon size={17} className="dashboard-search-icon" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
      />
    </label>
  )
}
