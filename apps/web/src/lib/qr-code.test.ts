// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test } from 'vitest'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { checkInQrText } from '@vada/contracts'
import { readerOptions } from '../registrations/qr-reader'
import { qrMatrix } from './qr-code'

// 칸 하나를 scale 픽셀로 그린 흑백 그림(RGBA). 스캐너가 캔버스에서 꺼내는 그림과 같은 모양이다.
function imageOf(matrix: boolean[][], scale = 4) {
  const size = matrix.length * scale
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = matrix[Math.floor(y / scale)]![Math.floor(x / scale)] ? 0 : 255
    data.set([value, value, value, 255], (y * size + x) * 4)
  }
  return { data, width: size, height: size, colorSpace: 'srgb' as const }
}

test('QrCode가 그리는 칸을 스캐너의 판독기로 읽으면 같은 글자가 나온다', async () => {
  const wasm = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))
  await prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) }, fireImmediately: true })
  const text = checkInQrText('0123456789abcdef'.repeat(4))
  const matrix = qrMatrix(text)
  // 대문자라 영숫자 모드: 버전 4(33칸) + 여백 2칸씩
  expect(matrix.length).toBe(37)
  const [result] = await readBarcodes(imageOf(matrix), readerOptions)
  expect(result?.text).toBe(text)
})
