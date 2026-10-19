// 서버 API를 같은 출처로 부른다. 성공하면 본문을, 실패하면 오류 코드를 돌려준다. 화면은 오류 코드로 문구를 고른다.
// 4xx는 서버가 준 코드(FORBIDDEN, DEPARTMENT_IN_USE 등)이고, 연결 실패와 5xx는 'FAILED'다. 204는 본문이 없다.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string }

async function call<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init })
    if (response.status === 204) return { ok: true, data: undefined as T }
    const body: unknown = await response.json().catch(() => null)
    if (response.ok && body !== null) return { ok: true, data: body as T }
    const code = (body as { error?: unknown } | null)?.error
    return { ok: false, status: response.status, code: response.status < 500 && typeof code === 'string' ? code : 'FAILED' }
  } catch {
    return { ok: false, status: 0, code: 'FAILED' }
  }
}

export const getJson = <T>(path: string, signal?: AbortSignal) => call<T>(path, { signal })
export const postJson = <T>(path: string, body: unknown) =>
  call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
