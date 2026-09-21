import { useEffect, useState } from 'react'

// Will this browser still be holding the guest's identity tomorrow?
//
// A guest has no password: whatever holds the token IS the account. Some
// browsers clear site data as a matter of policy — Brave's forget-first-party
// shield wipes a site's storage shortly after its last tab closes, Safari caps
// script-written storage at seven days without interaction, and a private
// window throws everything away on close. In those, "continue without signing
// in" quietly means "until you close this window", and the person deserves to
// be told that BEFORE they spend an evening on a site.
//
// Detection is deliberately conservative: anything uncertain counts as normal.
// Warning someone whose storage is fine is its own kind of lie, and it teaches
// them to ignore the warning that matters.

// Chrome/Brave hand a private window a small fixed quota; an ordinary profile
// gets a share of the disk, which is orders of magnitude larger.
const PRIVATE_QUOTA_CEILING = 400 * 1024 * 1024

async function isBrave() {
  try {
    return !!(navigator.brave && await navigator.brave.isBrave())
  } catch {
    return false
  }
}

async function looksPrivate() {
  try {
    const { quota } = await navigator.storage.estimate()
    return typeof quota === 'number' && quota > 0 && quota < PRIVATE_QUOTA_CEILING
  } catch {
    return false
  }
}

function isWebkit() {
  const ua = navigator.userAgent || ''
  // Safari only: Chrome and the other Chromium browsers also say AppleWebKit.
  return /AppleWebKit/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)
}

// { risky, reason } — reason is what to say, not just why.
export async function readStorageRisk() {
  if (await isBrave()) return { risky: true, reason: 'brave' }
  if (await looksPrivate()) return { risky: true, reason: 'private' }
  if (isWebkit()) return { risky: true, reason: 'webkit' }
  return { risky: false, reason: null }
}

export function useStorageRisk() {
  const [risk, setRisk] = useState({ risky: false, reason: null })
  useEffect(() => {
    let alive = true
    readStorageRisk().then((next) => { if (alive) setRisk(next) })
    return () => { alive = false }
  }, [])
  return risk
}

// One sentence per reason, in the browser's own terms.
export const RISK_MESSAGE = {
  brave: 'This browser clears a site’s data on its own, so work kept only here can disappear. Signing in keeps it.',
  private: 'A private window throws everything away when you close it — including work kept only in the browser. Signing in keeps it.',
  webkit: 'This browser drops a site’s stored data after a week without a visit, so work kept only here can disappear. Signing in keeps it.',
}
