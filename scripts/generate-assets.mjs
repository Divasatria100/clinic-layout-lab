// Generates Phase 1 placeholder object assets as PNG with alpha transparency
// (docs/08-asset-specification.md §6-§7: PNG + alpha mandatory for objects).
//
// Zero-dependency: rasterizes simple distinct icons per asset type and encodes
// PNG manually (zlib + CRC). Output: public/assets/objects/<type>.png.
//
// Usage: node scripts/generate-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(rootDir, 'public', 'assets', 'objects')
const SIZE = 128

const TYPES = [
  { type: 'entrance', color: [34, 197, 94], glyph: 'door' },
  { type: 'exit', color: [239, 68, 68], glyph: 'door-open' },
  { type: 'reception', color: [59, 130, 246], glyph: 'counter' },
  { type: 'waiting-chair', color: [168, 85, 247], glyph: 'chairs' },
  { type: 'examination-room', color: [6, 182, 212], glyph: 'bed' },
  { type: 'doctor-room', color: [99, 102, 241], glyph: 'desk' },
  { type: 'pharmacy', color: [245, 158, 11], glyph: 'cross' },
  { type: 'treatment-room', color: [20, 184, 166], glyph: 'plus-bed' },
  { type: 'toilet', color: [236, 72, 153], glyph: 'wc' },
]

function makeBuffer() {
  return Buffer.alloc(SIZE * SIZE * 4, 0)
}

function setPixel(buf, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
    return
  }
  const i = (y * SIZE + x) * 4
  buf[i] = r
  buf[i + 1] = g
  buf[i + 2] = b
  buf[i + 3] = a
}

function fillRect(buf, x0, y0, w, h, [r, g, b], a = 255) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      setPixel(buf, x, y, r, g, b, a)
    }
  }
}

function fillCircle(buf, cx, cy, radius, color, a = 255) {
  for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
        setPixel(buf, x, y, ...color, a)
      }
    }
  }
}

function drawGlyph(buf, glyph, color) {
  const white = [255, 255, 255]
  const dark = [10, 10, 10]
  switch (glyph) {
    case 'door':
      fillRect(buf, 44, 28, 40, 72, white)
      fillRect(buf, 48, 32, 32, 64, dark)
      fillCircle(buf, 72, 64, 4, white)
      break
    case 'door-open':
      fillRect(buf, 44, 28, 40, 72, white)
      fillRect(buf, 48, 32, 14, 64, dark)
      fillRect(buf, 66, 32, 14, 64, color)
      break
    case 'counter':
      fillRect(buf, 28, 60, 72, 20, white)
      fillRect(buf, 28, 84, 72, 12, white)
      fillCircle(buf, 64, 40, 12, white)
      break
    case 'chairs':
      fillRect(buf, 30, 44, 20, 44, white)
      fillRect(buf, 54, 44, 20, 44, white)
      fillRect(buf, 78, 44, 20, 44, white)
      break
    case 'bed':
      fillRect(buf, 24, 64, 80, 20, white)
      fillRect(buf, 24, 44, 12, 40, white)
      fillCircle(buf, 40, 56, 9, white)
      break
    case 'desk':
      fillRect(buf, 28, 68, 72, 12, white)
      fillRect(buf, 32, 80, 8, 20, white)
      fillRect(buf, 88, 80, 8, 20, white)
      fillRect(buf, 52, 36, 24, 24, white)
      break
    case 'cross':
      fillRect(buf, 52, 32, 24, 64, white)
      fillRect(buf, 32, 52, 64, 24, white)
      break
    case 'plus-bed':
      fillRect(buf, 24, 70, 60, 14, white)
      fillRect(buf, 88, 44, 12, 40, white)
      fillRect(buf, 80, 52, 28, 12, white)
      break
    case 'wc':
      fillCircle(buf, 52, 42, 10, white)
      fillRect(buf, 44, 56, 16, 36, white)
      fillCircle(buf, 80, 42, 10, white)
      fillRect(buf, 72, 56, 16, 36, white)
      break
    default:
      fillCircle(buf, 64, 64, 24, white)
  }
}

// Minimal PNG encoder (RGBA8, no interlace, filter 0 per scanline).
const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(rgba) {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (SIZE * 4 + 1)] = 0
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(outDir, { recursive: true })
for (const { type, color, glyph } of TYPES) {
  const buf = makeBuffer()
  // Category color tile with darker inner panel + white glyph.
  fillRect(buf, 8, 8, SIZE - 16, SIZE - 16, color)
  fillRect(buf, 16, 16, SIZE - 32, SIZE - 32, [10, 10, 10])
  drawGlyph(buf, glyph, color)
  writeFileSync(join(outDir, `${type}.png`), encodePng(buf))
  console.log(`wrote ${type}.png`)
}
