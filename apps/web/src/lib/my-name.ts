import { UpdateMeProfileSchema, type MeProfileResponse } from '@vada/contracts'
import { getJson } from './api'
import { requiredText, withContract, type FieldErrors } from './use-form-check'

// '내 이름' 칸의 문제(누를 때 확인한다). 이름은 운영진 하나라서 만들기·들어가기·내 이름 창이 같은 계약(운영진 이름 상한)으로 본다.
export const myNameErrors = (name: string): FieldErrors =>
  withContract({ name: requiredText(name, '이름을') }, UpdateMeProfileSchema.safeParse({ name }))

// 로그인에 이어진 운영진의 이름(GET /api/me/profile). 없으면 null이라 만들기·들어가기가 '내 이름' 칸을 보인다(기능 020 정한 것 8).
// 읽지 못해도 null(칸을 보임)이다. 이미 이어진 사람이 보낸 이름은 서버가 무시하므로 칸을 잘못 보여도 이름이 바뀌지 않는다.
export async function readMyName(signal: AbortSignal): Promise<string | null> {
  const result = await getJson<MeProfileResponse>('/api/me/profile', signal)
  return result.ok ? result.data.name : null
}
