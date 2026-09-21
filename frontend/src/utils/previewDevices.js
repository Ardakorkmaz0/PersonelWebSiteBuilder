// The widths a preview can be cut to.
//
// A site carries two designs — the desktop one and the mobile one — and which
// of them a visitor sees is decided by the width they happen to be browsing
// at. Before these, the only way to see the other design was to resize the
// window, so the owner published a mobile layout they had never looked at.
// "PC" is the browser window itself; the other two hand the site a device's
// width and let it lay itself out for it. Nothing is scaled down: this is the
// page as that device would draw it.
export const PREVIEW_DEVICES = [
  { id: 'pc', label: 'PC', width: 0 },
  { id: 'tablet', label: 'Tablet', width: 834 },
  { id: 'mobile', label: 'Mobile', width: 390 },
]

export function previewDeviceWidth(id) {
  return PREVIEW_DEVICES.find((device) => device.id === id)?.width || 0
}
