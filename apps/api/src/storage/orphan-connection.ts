import type postgres from 'postgres'
import { createObjectPurgeLock, type ObjectPurgeLock } from './orphan-lock.js'

function directUrlOf(value: string | undefined) {
  try {
    const url = new URL(value ?? '')
    const neonHost = /^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !neonHost.test(url.hostname) ||
      (url.port && url.port !== '5432') ||
      url.searchParams.has('host') ||
      url.searchParams.has('port')
    )
      return undefined
    // Neon의 직접·풀링 주소는 첫 호스트 구간 끝의 -pooler만 다르다.
    // https://neon.com/docs/connect/connection-pooling#how-to-use-connection-pooling
    url.hostname = url.hostname.replace(/^([^.]+)-pooler\./, '$1.')
    return url.toString()
  } catch {
    return undefined
  }
}

export function objectPurgeLockOf(
  databaseUrl: string | undefined,
  open: (
    url: string,
    options: postgres.Options<Record<string, never>>,
  ) => Pick<postgres.Sql, 'unsafe' | 'end'>,
): ObjectPurgeLock {
  const directUrl = directUrlOf(databaseUrl)
  if (directUrl) return createObjectPurgeLock(options => open(directUrl, options))
  return () => {
    console.error('사진 객체 정리 건너뜀: 직접 연결 주소를 확인할 수 없어요.')
    return Promise.resolve(false)
  }
}
