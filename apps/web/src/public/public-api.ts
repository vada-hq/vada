import type { MyRegistration, PublicRegistrationForm, RegisterRequest, RegistrationCreated } from '@vada/contracts'

// 로그인 없이 쓰는 참가 신청 API. 개인 링크 토큰은 주소가 아니라 본문에 담는다.
const base = '/api/public'
const isObject = (body: unknown): body is Record<string, unknown> => typeof body === 'object' && body !== null
const isForm = (body: unknown): body is PublicRegistrationForm => isObject(body) && typeof body.state === 'string' && isObject(body.event)
const isMine = (body: unknown): body is MyRegistration => isObject(body) && typeof body.code === 'string' && typeof body.cancelled === 'boolean'
const errorOf = (body: unknown) => isObject(body) && typeof body.error === 'string' ? body.error : null

export async function fetchPublicForm(code: string, signal?: AbortSignal): Promise<PublicRegistrationForm | 'missing' | 'failed'> {
  try {
    const response = await fetch(`${base}/registration-forms/${encodeURIComponent(code)}`, { cache: 'no-store', signal })
    if (response.status === 404) return 'missing'
    const body: unknown = await response.json()
    return response.ok && isForm(body) ? body : 'failed'
  } catch {
    return 'failed'
  }
}

async function post(path: string, body: unknown): Promise<{ ok: true; body: unknown } | { ok: false; status: number; code: string | null }> {
  try {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result: unknown = await response.json().catch(() => null)
    return response.ok ? { ok: true, body: result } : { ok: false, status: response.status, code: errorOf(result) }
  } catch {
    return { ok: false, status: 0, code: null }
  }
}

export type RegisterResult = { ok: true; token: string } | { ok: false; code: string | null }
export async function register(code: string, input: RegisterRequest): Promise<RegisterResult> {
  const result = await post(`/registration-forms/${encodeURIComponent(code)}/entries`, input)
  if (!result.ok) return { ok: false, code: result.code }
  const token = isObject(result.body) ? (result.body as Partial<RegistrationCreated>).token : undefined
  return typeof token === 'string' ? { ok: true, token } : { ok: false, code: null }
}

// missing: 토큰을 모르거나 취소·보관 기간이 지나 지운 신청. 그 밖의 실패는 다시 시도할 수 있다.
export type MineResult = { ok: true; registration: MyRegistration } | { ok: false; missing: boolean; code: string | null }
async function mine(path: string, token: string): Promise<MineResult> {
  const result = await post(path, { token })
  if (result.ok) return isMine(result.body) ? { ok: true, registration: result.body } : { ok: false, missing: false, code: null }
  return { ok: false, missing: result.status === 404 || result.status === 400, code: result.code }
}
export const lookup = (token: string) => mine('/registrations/lookup', token)
export const cancelMine = (token: string) => mine('/registrations/cancel', token)
