import { SourceStore } from './SourceStore'
import type { Server, SourceCall } from './server-contract'

export { NotBuiltYet, SourcesFailed, urlOf } from './server-contract'
export type { Server, SourceCall, SourceFailure } from './server-contract'

const sources = new SourceStore()

/** 서버 연결을 바꾸고 이전 연결로 되돌리는 함수를 반환한다. */
export function configureServer(next: Server | null): () => void {
  return sources.configure(next)
}

/** 변경 뒤 읽기 캐시를 모두 비운다. */
export function forgetSources(): void {
  sources.forget()
}

export function servingFromServer(): boolean {
  return sources.serving()
}

export function currentServer(): Server | null {
  return sources.current()
}

/** 사용자 신원이 바뀌면 이전 사용자의 캐시를 버린다. */
export function servingAs(identity: string): void {
  sources.serveAs(identity)
}

/** 필요한 출처들을 병렬로 받아 캐시에 저장한다. */
export function loadSources(calls: readonly SourceCall[]): Promise<void> {
  return sources.load(calls)
}

/** 캐시된 출처를 읽고, 없으면 로딩 약속을 던져 Suspense에 맡긴다. */
export function fromServer(key: string, params: Record<string, string> = {}): unknown {
  return sources.read(key, params)
}

/** 배포 환경에서 API가 있는 기준 주소다. */
export function apiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL
  return typeof base === 'string' ? base.replace(/\/$/, '') : ''
}

/** 세션 쿠키를 포함해 브라우저에서 API를 호출한다. */
export function browserFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, credentials: 'include' })
}

/** 앱 시작 시 실제 서버 데이터 사용을 켠다. */
export function startServing(): () => void {
  if (import.meta.env.VITE_FIXTURES === '1') return () => {}
  return configureServer({ baseUrl: apiBaseUrl(), fetch: browserFetch })
}
