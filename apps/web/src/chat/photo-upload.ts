import { FILE_NAME_MAX, PHOTO_MAX_BYTES, type PhotoUploadResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { uploadsPath } from './chat-api'
import { resizeToJpeg } from './photo-resize'

type UploadOutcome = { ok: true; key: string } | { ok: false; status: number; code: string }

// 파일 이름은 JPEG로 다시 저장했으므로 .jpg로 맞추고, 계약의 이름 상한(코드 포인트)에 자른다.
export function photoName(original: string) {
  const stem = original.replace(/\.[^.]*$/, '').trim() || '사진'
  return `${Array.from(stem)
    .slice(0, FILE_NAME_MAX - '.jpg'.length)
    .join('')}.jpg`
}

// 올리기 주소를 받아 저장소에 바로 올린다. 서버는 파일을 받지 않는다. 서버가 준 머리를 그대로 붙인다.
// 저장소는 다른 출처이므로 우리 쿠키를 보내지 않는다.
async function uploadPhoto(councilId: string, roomId: string, jpeg: Blob): Promise<UploadOutcome> {
  const signed = await postJson<PhotoUploadResponse>(uploadsPath(councilId, roomId), {})
  if (!signed.ok) return signed
  try {
    const response = await fetch(signed.data.url, {
      method: 'PUT',
      credentials: 'omit',
      headers: signed.data.headers,
      body: jpeg,
    })
    if (response.ok) return { ok: true, key: signed.data.key }
    // 저장소의 거절은 우리 서버의 상태와 섞이지 않게 연결 실패와 같이 다룬다.
    return { ok: false, status: 0, code: 'FAILED' }
  } catch {
    return { ok: false, status: 0, code: 'FAILED' }
  }
}

export const UNREADABLE = 'UNREADABLE'
export const TOO_BIG = 'TOO_BIG'

// 고른 파일을 줄여 올린다. 줄인 사진이 나오면 onPreview로 미리 보기를 넘긴다. 열 수 없으면 code가 UNREADABLE, 너무 크면 TOO_BIG이다.
export async function sendPhoto(
  where: { councilId: string; roomId: string },
  file: File,
  onPreview: (url: string) => void,
): Promise<UploadOutcome> {
  const jpeg = await resizeToJpeg(file)
  if (!jpeg) return { ok: false, status: 0, code: UNREADABLE }
  // 줄인 결과가 상한을 넘으면 올리지 않고 바로 알린다(올린 뒤 거절당하지 않게).
  if (jpeg.size > PHOTO_MAX_BYTES) return { ok: false, status: 0, code: TOO_BIG }
  onPreview(URL.createObjectURL(jpeg))
  return uploadPhoto(where.councilId, where.roomId, jpeg)
}
