// A small set of clean, consistent line icons (Heroicons-style, 24px grid,
// 1.8 stroke, currentColor) used across the app chrome instead of emoji — emoji
// render inconsistently per-OS and read as amateurish. Each takes `size`
// (default 16) and a `className`; stroke inherits the surrounding text color.
function Icon({ size = 16, className = '', children, fill = 'none', viewBox = '0 0 24 24', ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={fill === 'none' ? 'currentColor' : 'none'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const FileIcon = (p) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </Icon>
)

export const FileCodeIcon = (p) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 13 2 2-2 2" />
  </Icon>
)

export const FolderIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.4.6L13 8h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
  </Icon>
)

export const FolderOpenIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.4.6L13 8h5a2 2 0 0 1 2 2H6l-2 9" />
    <path d="m4 19 2.3-7.4A2 2 0 0 1 8.2 10H21l-2.3 7.4a2 2 0 0 1-1.9 1.6z" />
  </Icon>
)

// "Components" / blocks.
export const LayersIcon = (p) => (
  <Icon {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.2" />
    <rect x="13" y="4" width="7" height="7" rx="1.2" />
    <rect x="4" y="13" width="7" height="7" rx="1.2" />
    <rect x="13" y="13" width="7" height="7" rx="1.2" />
  </Icon>
)

export const SearchIcon = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Icon>
)

export const EyeIcon = (p) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const StarIcon = ({ filled = false, ...p }) => (
  <Icon {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L4.5 9.7l5.9-.9z" />
  </Icon>
)

export const FlagIcon = (p) => (
  <Icon {...p}>
    <path d="M4 21V4" />
    <path d="M4 4h12l-1.5 4L16 12H4" />
  </Icon>
)

export const ShieldIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
  </Icon>
)

export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="m5 12 4.5 4.5L19 7" />
  </Icon>
)

export const GlobeIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
  </Icon>
)

export const SparklesIcon = (p) => (
  <Icon {...p}>
    <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />
    <path d="M18 15l.7 2 .3.3 2 .7-2 .7-.3.3-.7 2-.7-2-.3-.3-2-.7 2-.7.3-.3z" />
  </Icon>
)

export const CodeIcon = (p) => (
  <Icon {...p}>
    <path d="m8 9-4 3 4 3" />
    <path d="m16 9 4 3-4 3" />
  </Icon>
)

export const LinkIcon = (p) => (
  <Icon {...p}>
    <path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11 6" />
    <path d="M14 11a4 4 0 0 0-5.7 0L5.7 13.6a4 4 0 0 0 5.7 5.7L13 18" />
  </Icon>
)

export const PaletteIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4-4-7-9-7z" />
    <circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="9.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
  </Icon>
)

export const CogIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </Icon>
)

export const ImageIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m21 16-4.5-4.5L7 21" />
  </Icon>
)

export const PlusIcon = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const SaveIcon = (p) => (
  <Icon {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </Icon>
)

export const NoteIcon = (p) => (
  <Icon {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Icon>
)

export const LightbulbIcon = (p) => (
  <Icon {...p}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.8 1.2 1.5 1.4 2.5" />
  </Icon>
)

export const PinIcon = (p) => (
  <Icon {...p}>
    <path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
)

export const BanIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m6 6 12 12" />
  </Icon>
)

export const TrashIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 14h10l1-14" />
    <path d="M9 7V4h6v3" />
  </Icon>
)

export const KeyboardIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
  </Icon>
)

export const EditIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
)

export const MoveIcon = (p) => (
  <Icon {...p}>
    <path d="M12 4v16M8 7l4-3 4 3M8 17l4 3 4-3" />
  </Icon>
)

export const WarningIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3 2.5 20h19z" />
    <path d="M12 10v4" />
    <path d="M12 17.5h.01" />
  </Icon>
)

export const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)
