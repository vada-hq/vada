// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { fitSize, resizeToJpeg } from './photo-resize'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('긴 변이 2048을 넘으면 비율대로 줄이고, 작은 사진은 키우지 않는다', () => {
  expect(fitSize(4096, 3072)).toEqual({ width: 2048, height: 1536 })
  expect(fitSize(3000, 6000)).toEqual({ width: 1024, height: 2048 })
  expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 })
})

function stubCanvas(blob: Blob | null) {
  const toBlob = vi.fn((done: (value: Blob | null) => void) => done(blob))
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
    toBlob,
  }
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
  return { canvas, toBlob }
}

test('다시 그린 JPEG를 돌려준다(원본 바이트를 쓰지 않는다)', async () => {
  vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ width: 4000, height: 2000, close: vi.fn() }),
  )
  const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' })
  const { canvas, toBlob } = stubCanvas(jpeg)
  const original = new Blob(['원본 EXIF'], { type: 'image/jpeg' })
  const result = await resizeToJpeg(original)
  expect(result).toBe(jpeg)
  expect(result).not.toBe(original)
  expect([canvas.width, canvas.height]).toEqual([2048, 1024])
  expect(toBlob.mock.calls[0]?.slice(1)).toEqual(['image/jpeg', 0.85])
})

test('열 수 없는 파일은 null이다', async () => {
  vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('열 수 없음')))
  expect(await resizeToJpeg(new Blob(['heic']))).toBeNull()
})

test('풀기 전에 크기를 읽어 긴 변 기준으로 줄여 풀고, 사진에 적힌 방향을 따른다', async () => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() }),
  )
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 3000
      naturalHeight = 6000
      src = ''
      decode = () => Promise.resolve()
    },
  )
  const decode = vi.fn((_file: Blob, _options?: object) =>
    Promise.resolve({ width: 1024, height: 2048, close: vi.fn() }),
  )
  vi.stubGlobal('createImageBitmap', decode)
  stubCanvas(new Blob(['jpeg']))
  await resizeToJpeg(new Blob(['raw']))
  expect(decode.mock.calls[0]?.[1]).toEqual({
    imageOrientation: 'from-image',
    resizeWidth: 1024,
    resizeHeight: 2048,
    resizeQuality: 'high',
  })
})
