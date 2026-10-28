import { isUuid, UUID_LENGTH } from '@vada/contracts'

const STORAGE_KEY_PARTS = 4

// URL로 정규화될 여지를 없애고 업로드·복사가 만드는 키만 삭제 후보로 인정한다.
export function isStorageKey(key: string) {
  const [area, ...ids] = key.split('/')
  return (
    ids.length === STORAGE_KEY_PARTS - 1 &&
    (area === 'chat' || area === 'evidence') &&
    ids.every(id => id.length === UUID_LENGTH && isUuid(id))
  )
}
