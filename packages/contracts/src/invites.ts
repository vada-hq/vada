import { z } from 'zod'
import { token } from './input.js'
import type { MyCouncil } from './councils.js'

// 와이어프레임 INV-00의 8자리 초대 코드. 사람이 입력하므로 공백·하이픈·소문자를 받아 정규화한다(지금 vada와 같다).
export const INVITE_CODE_MAX = 16
export const InviteCodeSchema = token(INVITE_CODE_MAX)
  .transform(value => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().min(1))
export const JoinCouncilSchema = z.strictObject({ code: InviteCodeSchema })
export type JoinCouncilRequest = z.infer<typeof JoinCouncilSchema>

// 초대 확인: 코드만 아는 사람에게는 학생회 이름까지만 보여 준다. joined는 이미 지금 기수에 들어왔는지다.
export interface InvitePreviewResponse { council: { id: string; name: string }; joined: boolean }
export interface JoinCouncilResponse { council: MyCouncil }
// 초대 코드 보기와 바꾸기(회장단)
export interface InviteCodeResponse { code: string }
