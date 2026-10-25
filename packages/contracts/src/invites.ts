import { z } from 'zod'
import { token } from './input.js'
import type { CouncilUnit, MyCouncil } from './councils.js'
import { memberNameInput } from './profile.js'

// 와이어프레임 INV-00의 8자리 초대 코드. 사람이 입력하므로 공백·하이픈·소문자를 받아 정규화한다(지금 vada와 같다).
export const INVITE_CODE_MAX = 16
export const InviteCodeSchema = token(INVITE_CODE_MAX)
  .transform(value => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().min(1))
// 내 이름은 로그인에 처음 운영진을 이을 때만 쓴다(이미 이어졌으면 무시한다).
export const JoinCouncilSchema = z.strictObject({
  code: InviteCodeSchema,
  memberName: memberNameInput.optional(),
})
export type JoinCouncilRequest = z.infer<typeof JoinCouncilSchema>

// 초대 확인: 코드만 아는 사람에게는 맞는 학생회인지 가릴 것(이름, 유형, 학교, 지금 기수 이름)까지만 보여 준다.
// 운영진 수·이름과 초대한 사람은 싣지 않는다(DEC-87). cohortName은 지금 기수가 없으면 null이다. joined는 이미 지금 기수에 들어왔는지다.
export interface InvitePreviewResponse {
  council: {
    id: string
    name: string
    unit: CouncilUnit
    schoolName: string
    cohortName: string | null
  }
  joined: boolean
}
export interface JoinCouncilResponse {
  council: MyCouncil
}
// 초대 코드 보기와 바꾸기(회장단)
export interface InviteCodeResponse {
  code: string
}
