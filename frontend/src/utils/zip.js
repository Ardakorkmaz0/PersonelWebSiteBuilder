// Minimal ZIP writer (STORE method — no compression) for bundling the small
// generated HTML/CSS/JSON files into a .zip, with no external dependency.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const enc = new TextEncoder()
const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff]
const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

// files: [{ name, content }] where content is a string. Returns a Blob.
export function zipFiles(files) {
  const chunks = []
  const central = []
  let offset = 0

  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const data = enc.encode(f.content)
    const crc = crc32(data)
    const size = data.length

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), // mod time / date
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0),
    ]
    chunks.push(new Uint8Array(local), nameBytes, data)

    const cen = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset),
    ]
    central.push({ head: new Uint8Array(cen), name: nameBytes })
    offset += local.length + nameBytes.length + data.length
  }

  const cdirStart = offset
  let cdirSize = 0
  for (const c of central) {
    chunks.push(c.head, c.name)
    cdirSize += c.head.length + c.name.length
  }

  chunks.push(
    new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0),
      ...u16(central.length), ...u16(central.length),
      ...u32(cdirSize), ...u32(cdirStart), ...u16(0),
    ]),
  )

  return new Blob(chunks, { type: 'application/zip' })
}
