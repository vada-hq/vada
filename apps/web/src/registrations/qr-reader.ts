import type { ReaderOptions } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// 출석 QR만 읽는다. 휴대폰 화면의 QR은 반사·기울기가 있어 tryHarder를 켠다.
const readerOptions: ReaderOptions = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 }
// 보이는 정사각형을 이 크기(한 변)까지 줄여 읽는다. 휴대폰에서도 한 번에 수십 ms 안이다.
const READ_SIDE = 640
const HALF = 2
export type QrReader = { read: (video: HTMLVideoElement) => Promise<string | null> }

// 카메라 화면(정사각형, object-cover)에 보이는 가운데 정사각형. 화면에 보이지 않는 옆 사람·뒷사람의 QR은 읽지 않는다.
export function visibleSquare(width: number, height: number) {
  const side = Math.min(width, height)
  return { x: Math.round((width - side) / HALF), y: Math.round((height - side) / HALF), side }
}

let loading: Promise<typeof import('zxing-wasm/reader')> | null = null
// 판독기(zxing-wasm)는 스캐너를 처음 열 때만 받는다. wasm은 빌드가 /assets/에 내보낸 우리 파일이다(외부 CDN을 쓰지 않는다).
// 실패하면 다음 시도에서 다시 받는다.
function readerModule() {
  loading ??= import('zxing-wasm/reader')
    .then(async zxing => {
      await zxing.prepareZXingModule({
        overrides: {
          locateFile: (path: string, prefix: string) =>
            path.endsWith('.wasm') ? wasmUrl : prefix + path,
        },
        fireImmediately: true,
      })
      return zxing
    })
    .catch((error: unknown) => {
      loading = null
      throw error
    })
  return loading
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
      const { x, y, side } = visibleSquare(width, height)
      const size = Math.min(side, READ_SIDE)
      canvas.width = size
      canvas.height = size
      context.drawImage(video, x, y, side, side, 0, 0, size, size)
      const [result] = await readBarcodes(context.getImageData(0, 0, size, size), readerOptions)
      return result?.isValid ? result.text : null
    },
  }
}
