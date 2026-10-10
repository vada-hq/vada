import { z } from 'zod'
import type { ExpensePerson } from './expenses.js'
import { text, token } from './input.js'
import { PURCHASE_INTEGER_MAX, purchaseDate } from './purchases.js'
import { REGISTRATION_NAME_MAX, studentIdInput } from './registrations.js'

export const FEE_BANK_MAX = 20
export const FEE_HOLDER_MAX = 30
export const FEE_ACCOUNT_NUMBER_MAX = 30
// 참가비 설정 화면은 계좌를 바꾼 기록을 이만큼 보여 준다.
export const FEE_ACCOUNT_HISTORY_MAX = 20
export const DUES_ROSTER_LABEL_MAX = 30
export const DUES_ROSTER_MEMBERS_MAX = 10_000
// 쓰는 기한은 올리는 날부터 이만큼 안이다. 적어도 1년마다 명단을 다시 올려 맞추게 한다.
export const DUES_ROSTER_USE_DAYS_MAX = 366

// 계좌·명단 행이 없으면 버전 0이다. 첫 변경이 버전 1로 행을 만든다.
const version = z.number().int().min(0).max(PURCHASE_INTEGER_MAX)
const digitCount = (value: string) => value.replace(/-/g, '').length
// 계좌번호: 넣은 공백을 빼고 숫자와 하이픈만 쓴다. 숫자는 8~20자리다.
export const accountNumberInput = token(40).transform(value => value.replace(/\s/g, ''))
  .refine(value => /^\d+(-\d+)*$/.test(value) && value.length <= FEE_ACCOUNT_NUMBER_MAX && digitCount(value) >= 8 && digitCount(value) <= 20)
// 참가비를 받는 학생회 계좌. 재정 담당자가 정한다.
export const SetFeeAccountSchema = z.strictObject({ version, bank: text(FEE_BANK_MAX), accountNumber: accountNumberInput, holder: text(FEE_HOLDER_MAX) })
const useUntil = purchaseDate.refine(value => value >= '2000-01-01' && value <= '2999-12-31')
// 학생회비 납부자 한 명. 학번은 참가 신청과 같게 정리한다.
export const DuesMemberSchema = z.strictObject({ studentId: studentIdInput, name: text(REGISTRATION_NAME_MAX) })
// 지금 쓰는 명단을 통째로 바꾼다. 쓰는 기한이 오늘부터 1년 안인지는 서버가 본다.
export const ReplaceDuesRosterSchema = z.strictObject({
  version,
  label: text(DUES_ROSTER_LABEL_MAX),
  useUntil,
  members: z.array(DuesMemberSchema).min(1).max(DUES_ROSTER_MEMBERS_MAX),
}).refine(value => new Set(value.members.map(member => member.studentId)).size === value.members.length)
export const DeleteDuesRosterSchema = z.strictObject({ version: z.number().int().min(1).max(PURCHASE_INTEGER_MAX) })
export type SetFeeAccountRequest = z.infer<typeof SetFeeAccountSchema>
export type ReplaceDuesRosterRequest = z.infer<typeof ReplaceDuesRosterSchema>
export type DeleteDuesRosterRequest = z.infer<typeof DeleteDuesRosterSchema>

export interface FeeAccount {
  bank: string
  accountNumber: string
  holder: string
}
export interface FeeAccountView extends FeeAccount {
  version: number
  updatedAt: string
  updatedBy: ExpensePerson
}
// 계좌를 정하거나 바꾼 기록. 처음 정했으면 from이 null이다.
export interface FeeAccountChange {
  id: string
  actor: ExpensePerson
  from: FeeAccount | null
  to: FeeAccount
  createdAt: string
}
export interface DuesMember {
  studentId: string
  name: string
}
export interface DuesRosterView {
  label: string
  // 이 날(한국 날짜)까지 쓰고, 그다음 날 지운다.
  useUntil: string
  version: number
  uploadedAt: string
  uploadedBy: ExpensePerson
  // 학번 순
  members: DuesMember[]
}
export interface FeeSettingsResponse {
  account: FeeAccountView | null
  // 최근 것부터
  accountHistory: FeeAccountChange[]
  roster: DuesRosterView | null
}
