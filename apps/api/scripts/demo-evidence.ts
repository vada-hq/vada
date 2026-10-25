import { PHOTO_MEDIA_TYPE } from '@vada/contracts'
import type { FileStorage } from '../src/storage/storage.js'

// 시연 증빙 파일: 1x1 흰색 JPEG 하나를 모든 증빙이 같이 쓴다. 서버가 파일 바이트를 받지 않으므로(서명 주소로 저장소에 바로 올린다) 시연도 같은 길로 올린다.
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
)

// 서버가 내준 키로 올리기 주소를 다시 받아 올린다(키는 학생회와 올린 운영진이 든 서버의 것이다). 실패하면 던진다.
export async function uploadDemoEvidence(
  storage: FileStorage,
  key: string,
  fetcher: typeof fetch,
): Promise<void> {
  const signed = await storage.uploadUrl(key, PHOTO_MEDIA_TYPE)
  const response = await fetcher(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: TINY_JPEG,
  })
  if (!response.ok) throw new Error('STORAGE_UPLOAD_FAILED')
}
