// Composes the profile's outbound links (website + socials) into render-ready
// { id, label, href } entries. Social fields accept either a bare handle
// ("@arda", "ardakorkmaz") or a full URL — bare handles get the platform's
// canonical base. Everything passes through sanitizeUrl so a stored value can
// never render a javascript: href (the backend rejects those too).
import { sanitizeUrl } from './sanitize.js'

const SOCIAL_BASES = {
  github: 'https://github.com/',
  twitter: 'https://x.com/',
  instagram: 'https://instagram.com/',
}

// Short display text for a link chip: host + path, no protocol, no trailing /.
function linkLabel(href) {
  return String(href)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
}

export function profileLinks(profile) {
  const out = []
  const website = String(profile?.website || '').trim()
  if (website) {
    const href = sanitizeUrl(website.includes('://') ? website : `https://${website}`)
    if (href) out.push({ id: 'website', label: linkLabel(href), href })
  }
  for (const id of ['github', 'twitter', 'instagram']) {
    const raw = String(profile?.[id] || '').trim()
    if (!raw) continue
    const href = raw.includes('://')
      ? sanitizeUrl(raw)
      : sanitizeUrl(SOCIAL_BASES[id] + raw.replace(/^@/, ''))
    if (href) out.push({ id, label: raw.replace(/^@/, '').includes('://') ? linkLabel(raw) : raw.replace(/^@/, ''), href })
  }
  return out
}
