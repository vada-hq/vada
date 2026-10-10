import type { ReaderOptions } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// 참석 확인 QR만 읽는다. 휴대폰 화면의 QR은 반사·기울기가 있어 tryHarder를 켠다.
export const readerOptions: ReaderOptions = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 }
// 프레임을 이 크기(긴 변)까지 줄여 읽는다. 휴대폰에서도 한 번에 수십 ms 안이다.
const longSide = 640
export type QrReader = { read: (video: HTMLVideoElement) => Promise<string | null> }

let module: Promise<typeof import('zxing-wasm/reader')> | null = null
// 판독기(zxing-wasm)는 스캐너를 처음 열 때만 받는다. wasm은 빌드가 /assets/에 내보낸 우리 파일이다(외부 CDN을 쓰지 않는다).
// 실패하면 다음 시도에서 다시 받는다.
function readerModule() {
  module ??= import('zxing-wasm/reader').then(async zxing => {
    await zxing.prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => path.endsWith('.wasm') ? wasmUrl : prefix + path },
      fireImmediately: true })
    return zxing
  }).catch((error: unknown) => {
    module = null
    throw error
  })
  return module
}

export async function loadQrReader(): Promise<QrReader> {
  const { readBarcodes } = await readerModule()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas unavailable')
  return {
    async read(video) {
      const { videoWidth: width, videoHeight: height } = video
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !width || !height) return null
      const scale = Math.min(1, longSide / Math.max(width, height))
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const [result] = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), readerOptions)
      return result?.isValid ? result.text : null
    },
  }
}
