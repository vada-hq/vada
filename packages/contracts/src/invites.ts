import { z } from 'zod'
import { token } from './input.js'

// 와이어프레임 INV-00의 8자리 초대 코드. 사람이 입력하므로 공백·하이픈·소문자를 받아 정규화한다.
export const INVITE_CODE_MAX = 16
export const InviteCodeSchema = token(INVITE_CODE_MAX)
  .transform(value => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().min(1))
export const JoinOrganizationSchema = z.strictObject({ code: InviteCodeSchema })
export type JoinOrganizationRequest = z.infer<typeof JoinOrganizationSchema>
// 코드만 아는 사람에게는 학생회 이름까지만 보여 준다.
export interface InvitePreviewResponse {
  organization: { id: string; name: string }
  joined: boolean
}
