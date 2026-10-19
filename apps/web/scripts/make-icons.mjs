// 앱 아이콘을 만든다: 파란 정사각형(--primary) 안의 흰 V. 로고(BrandMark)와 같은 모양이다.
// 의존성 없이 PNG를 쓴다. 모양을 바꿀 때만 다시 돌린다: node apps/web/scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BLUE = [0x15, 0x5d, 0xfc]
const WHITE = [0xff, 0xff, 0xff]
const SAMPLES = 4 // 한 픽셀을 4×4로 나눠 가장자리를 부드럽게 한다.

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes) {
  let c = 0xffffffff
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

// 점에서 선분까지의 거리
function distance(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

// V의 두 획. 단위 정사각형(0~1) 좌표다. scale은 가운데를 기준으로 줄인다(마스크용 아이콘의 안전 영역).
function inV(u, v, scale) {
  const at = (x, y) => [0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale]
  const bottom = at(0.5, 0.7)
  const half = 0.065 * scale
  return distance(u, v, at(0.3, 0.3), bottom) <= half || distance(u, v, at(0.7, 0.3), bottom) <= half
}

function icon(size, scale) {
  const row = size * 3 + 1 // 줄마다 맨 앞 1바이트는 필터(0)다.
  const raw = Buffer.alloc(size * row)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          if (inV((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size, scale)) hits++
        }
      }
      const cover = hits / (SAMPLES * SAMPLES)
      for (let c = 0; c < 3; c++) raw[y * row + 1 + x * 3 + c] = Math.round(BLUE[c] + (WHITE[c] - BLUE[c]) * cover)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 채널당 8비트
  header[9] = 2 // RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const publicDir = new URL('../public/', import.meta.url)
mkdirSync(new URL('icons/', publicDir), { recursive: true })
for (const [path, size, scale] of [['icons/icon-192.png', 192, 1], ['icons/icon-512.png', 512, 1],
  ['icons/maskable-512.png', 512, 0.8], ['apple-touch-icon.png', 180, 1]]) {
  writeFileSync(new URL(path, publicDir), icon(size, scale))
  console.log(`${path} ${size}px`)
}
