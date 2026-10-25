import { z } from 'zod'
import { text } from './input.js'

// 운영진 이름의 상한. 이름은 학생회마다가 아니라 운영진 하나라서 고치면 그 사람이 든 모든 학생회에서 바뀐다(DEC-87).
export const MEMBER_NAME_MAX = 50
export const memberNameInput = text(MEMBER_NAME_MAX)

// 내 이름: 로그인에 이어진 운영진의 이름. 아직 학생회를 만들거나 들어오지 않아 이어진 운영진이 없으면 null이다.
export interface MeProfileResponse {
  name: string | null
}
// 내 이름 고치기. 바뀐 사람은 나로 판에 남는다.
export const UpdateMeProfileSchema = z.strictObject({ name: memberNameInput })
export type UpdateMeProfileRequest = z.infer<typeof UpdateMeProfileSchema>
