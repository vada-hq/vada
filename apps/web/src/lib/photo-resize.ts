// 대화 사진은 휴대폰에서 긴 변 2048px JPEG로 다시 저장해 올린다. 다시 저장하면 위치 정보(EXIF GPS)가 빠지므로
// 원본은 어디에도 올라가지 않는다(결정 0050). 다시 저장할 수 없는 파일은 올리지 않는다.
import { PHOTO_MEDIA_TYPE } from '@vada/contracts'

const PHOTO_MAX_EDGE = 2048
const PHOTO_QUALITY = 0.85

// 긴 변이 상한을 넘을 때만 비율대로 줄인다. 키우지 않는다.
export function fitSize(width: number, height: number, max = PHOTO_MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>(done => canvas.toBlob(done, PHOTO_MEDIA_TYPE, PHOTO_QUALITY))

// 풀기 전에 그림 크기만 읽는다(열 수 없으면 null). 큰 사진을 원본 크기로 풀지 않으려고 줄일 크기를 먼저 정한다.
async function probeSize(file: Blob) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 방향은 사진에 적힌 대로 세우고, 긴 변이 상한을 넘으면 풀 때부터 줄인다.
async function decode(file: Blob) {
  const probed = await probeSize(file)
  const target = probed && fitSize(probed.width, probed.height)
  const shrink = probed && target && target.width < probed.width
  return createImageBitmap(file, {
    imageOrientation: 'from-image',
    ...(shrink
      ? { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'high' }
      : {}),
  })
}

// 열 수 없는 파일(HEIF를 못 여는 브라우저, 사진이 아닌 파일)은 null이다.
export async function resizeToJpeg(file: Blob): Promise<Blob | null> {
  try {
    const bitmap = await decode(file)
    const size = fitSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) return null
    // 투명한 PNG가 JPEG에서 검게 되지 않게 흰 바탕을 깐다.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, size.width, size.height)
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    bitmap.close()
    return await toBlob(canvas)
  } catch {
    return null
  }
}
