// Small drawings for the starting guide, in the app's own vocabulary: an
// artboard with blocks landing on it, a page arriving from a file, a folder
// whose files are the page. Stock icons would say "generic product"; these say
// what this editor actually does, and they are the same three shapes the rails
// use, so the guide reads as part of the app rather than a brochure inside it.

function Frame({ children, className = '' }) {
  return (
    <svg
      viewBox="0 0 120 84"
      className={`guide-art ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

// An empty artboard, two blocks already placed, one dropping into the grid.
export function ScratchArt() {
  return (
    <Frame className="guide-art-scratch">
      <rect x="10.5" y="10.5" width="99" height="63" rx="5" className="guide-art-sheet" />
      <path d="M10.5 22.5h99" opacity="0.5" />
      <circle cx="17" cy="16.5" r="1.4" fill="currentColor" stroke="none" opacity="0.55" />
      <circle cx="22.5" cy="16.5" r="1.4" fill="currentColor" stroke="none" opacity="0.55" />
      <rect x="19" y="30" width="38" height="9" rx="2.5" className="guide-art-block" />
      <rect x="19" y="45" width="24" height="18" rx="2.5" className="guide-art-block" />
      <rect x="49" y="45" width="24" height="18" rx="2.5" className="guide-art-block" />
      {/* The one being placed: dashed until it lands. */}
      <rect x="79" y="30" width="22" height="33" rx="2.5" className="guide-art-drop" strokeDasharray="4 3" />
      <path d="M90 39v9" className="guide-art-accent-stroke" />
      <path d="m86.5 44.5 3.5 3.5 3.5-3.5" className="guide-art-accent-stroke" />
    </Frame>
  )
}

// A file lifting into a page that already exists.
export function UploadArt() {
  return (
    <Frame className="guide-art-upload">
      <rect x="10.5" y="10.5" width="99" height="63" rx="5" className="guide-art-sheet" />
      <path d="M10.5 22.5h99" opacity="0.5" />
      <path d="M22 34h30M22 42h44M22 50h22" opacity="0.65" />
      <path d="M72 58.5 66 51l6-7.5" className="guide-art-code" opacity="0.8" />
      <path d="m84 43.5 6 7.5-6 7.5" className="guide-art-code" opacity="0.8" />
      <path d="M78 41.5 75 60" className="guide-art-code" opacity="0.55" />
      {/* The incoming file. */}
      <g className="guide-art-lift">
        <path d="M84 12h12l6 6v14a2 2 0 0 1-2 2H84a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z" className="guide-art-accent-fill" />
        <path d="M96 12v6h6" className="guide-art-accent-stroke" />
        <path d="M92 29v-8M89 24l3-3 3 3" className="guide-art-accent-stroke" />
      </g>
    </Frame>
  )
}

// A folder open on the desk: the files themselves are what gets edited.
export function FolderArt() {
  return (
    <Frame className="guide-art-folder">
      <path d="M10.5 20.5a4 4 0 0 1 4-4h20l7 7h64a4 4 0 0 1 4 4v42a4 4 0 0 1-4 4h-91a4 4 0 0 1-4-4Z" className="guide-art-sheet" />
      <path d="M26 39h26M26 50h34M26 61h20" opacity="0.6" />
      <rect x="66" y="33" width="38" height="34" rx="3" className="guide-art-block" />
      <path d="M72 41h26M72 49h20M72 57h24" opacity="0.55" />
      <circle cx="18.5" cy="39" r="2" className="guide-art-accent-fill" strokeWidth="0" />
      <circle cx="18.5" cy="50" r="2" fill="currentColor" stroke="none" opacity="0.35" />
      <circle cx="18.5" cy="61" r="2" fill="currentColor" stroke="none" opacity="0.35" />
    </Frame>
  )
}
