import type { FileStorage } from '../storage/storage.js'

// 실제 R2에 닿지 않는 파일 저장소. put으로 올린 것처럼 객체를 두고, 지운 키를 기록한다.
export function fakeStorage() {
  const objects = new Map<string, { size: number; contentType: string }>()
  const bodies = new Map<string, Uint8Array>()
  // 읽기에 실패하게 할 키
  const unreadable = new Set<string>()
  const removed: string[] = []
  const copied: [string, string][] = []
  // 복사 뒤 새 객체를 원본과 다르게 만들거나(corruptCopy), 복사 자체를 실패시킨다(failCopy)
  const flags = { corruptCopy: false, failCopy: false }
  const issued: string[] = []
  const storage: FileStorage = {
    uploadUrl(key, contentType) {
      issued.push(key)
      return Promise.resolve({
        url: `https://r2.test/up/${key}`,
        headers: { 'Content-Type': contentType, 'If-None-Match': '*' },
        expiresAt: new Date('2026-10-19T03:10:00Z'),
      })
    },
    downloadUrl: (key, fileName, contentType) =>
      Promise.resolve(
        `https://r2.test/down/${key}?n=${encodeURIComponent(fileName)}&t=${encodeURIComponent(contentType)}`,
      ),
    head: key => Promise.resolve(objects.get(key) ?? null),
    read(key) {
      if (unreadable.has(key)) return Promise.reject(new Error('STORAGE_READ_FAILED'))
      return Promise.resolve(bodies.get(key) ?? null)
    },
    copy(fromKey, toKey) {
      const source = objects.get(fromKey)
      if (flags.failCopy || !source || objects.has(toKey))
        return Promise.reject(new Error('STORAGE_COPY_FAILED'))
      copied.push([fromKey, toKey])
      objects.set(toKey, flags.corruptCopy ? { ...source, size: source.size + 1 } : source)
      const body = bodies.get(fromKey)
      if (body) bodies.set(toKey, body)
      return Promise.resolve()
    },
    remove(key) {
      removed.push(key)
      objects.delete(key)
      return Promise.resolve()
    },
  }
  return {
    storage,
    removed,
    copied,
    flags,
    issued,
    put: (key: string, size = 1000, contentType = 'image/jpeg') =>
      void objects.set(key, { size, contentType }),
    // 읽을 수 있는 바이트를 둔다(증빙 묶음 시험)
    putBody(key: string, body: Uint8Array) {
      objects.set(key, { size: body.length, contentType: 'image/jpeg' })
      bodies.set(key, body)
    },
    unreadable,
    has: (key: string) => objects.has(key),
  }
}
