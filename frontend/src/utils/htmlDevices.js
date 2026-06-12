// Device frames for previewing HTML pages — shared by the editor header
// (selector lives there) and the HtmlWorkspace stage (sizing math).
export const DEVICES = [
  { id: 'fit', label: 'Responsive - area width', w: 0, h: 0 },
  { id: 'desktop-16-9', label: 'Desktop 16:9 - 1280x720', w: 1280, h: 720 },
  { id: 'desktop-16-10', label: 'Desktop 16:10 - 1280x800', w: 1280, h: 800 },
  { id: 'laptop', label: 'Laptop - 1440x900', w: 1440, h: 900 },
  { id: 'fhd', label: 'Full HD - 1920x1080', w: 1920, h: 1080 },
  { id: 'ipad', label: 'iPad - 768x1024', w: 768, h: 1024 },
  { id: 'ipadpro', label: 'iPad Pro - 1024x1366', w: 1024, h: 1366 },
  { id: 'iphonese', label: 'iPhone SE - 375x667', w: 375, h: 667 },
  { id: 'iphone15', label: 'iPhone 15 - 393x852', w: 393, h: 852 },
  { id: 'iphonemax', label: 'iPhone Pro Max - 430x932', w: 430, h: 932 },
  { id: 'galaxys', label: 'Galaxy S - 360x780', w: 360, h: 780 },
  { id: 'galaxyultra', label: 'Galaxy Ultra - 384x824', w: 384, h: 824 },
  { id: 'android', label: 'Large Android - 412x915', w: 412, h: 915 },
]

// Is this device a phone-sized frame? Drives the PC/Mobile quick toggle.
export const isMobileDevice = (id) => {
  const d = DEVICES.find((x) => x.id === id)
  return !!d && d.w > 0 && d.w < 768
}
