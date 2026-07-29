// The site icon as a browser draws it: the real favicon when there is one, the
// site's initial on an accent tile when there is not. Its own module so both
// preview frames — the desktop window and the phone browser — show the same
// mark, and so neither has to export a non-component.
import { sanitizeImageSrc } from '../../utils/sanitize.js'

export default function BrowserFavicon({ src, title }) {
  const safeSrc = sanitizeImageSrc(src)
  if (safeSrc) {
    return <img src={safeSrc} alt="" className="h-4 w-4 shrink-0 rounded-[4px] object-cover" />
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-[var(--studio-accent)] text-[9px] font-bold text-white"
    >
      {(String(title || 'S').trim()[0] || 'S').toLocaleUpperCase()}
    </span>
  )
}
