import { NO_CONTENT, SERVER_ERROR_FROM, statusOf } from '@vada/contracts'

// 서버 API를 같은 출처로 부른다. 성공하면 본문을, 실패하면 오류 코드를 돌려준다. 화면은 오류 코드로 문구를 고른다.
// 4xx는 서버가 준 코드(FORBIDDEN, DEPARTMENT_IN_USE 등)이고, 연결 실패와 5xx는 'FAILED'다. 본문 없는 성공도 있다.
const STORAGE_OFF = 'STORAGE_NOT_CONFIGURED'
// 5xx의 코드는 믿지 않는다. 다만 사진 저장소가 꺼져 있다는 503은 화면이 문구를 바꾸므로 그 코드만 믿는다.
const trusted = (status: number, code: unknown): code is string =>
  typeof code === 'string' &&
  (status < SERVER_ERROR_FROM || (status === statusOf(STORAGE_OFF) && code === STORAGE_OFF))

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string }

// 로그인이 풀리면(쿠키 만료) 어느 API든 UNAUTHENTICATED를 준다. 화면이 "서버 연결을 확인해 주세요"로 보이지 않도록, 앱이 등록한 처리기가 세션을 다시 읽어 로그인 화면으로 돌려보낸다.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

async function call<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init })
    if (response.status === statusOf('UNAUTHENTICATED')) onUnauthorized?.()
    if (response.status === NO_CONTENT) return { ok: true, data: undefined as T }
    const body: unknown = await response.json().catch(() => null)
    if (response.ok && body !== null) return { ok: true, data: body as T }
    const code = (body as { error?: unknown } | null)?.error
    return {
      ok: false,
      status: response.status,
      code: trusted(response.status, code) ? code : 'FAILED',
    }
  } catch {
    return { ok: false, status: 0, code: 'FAILED' }
  }
}

export const getJson = <T>(path: string, signal?: AbortSignal) =>
  call<T>(path, signal ? { signal } : {})
export const postJson = <T>(path: string, body: unknown) =>
  call<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
