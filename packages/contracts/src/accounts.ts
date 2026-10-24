import { z } from 'zod'
import { EmptyRequestSchema, text, token } from './input.js'

// 계좌(DEC-45). 값은 DB CHECK와 같다.
export const ACCOUNT_NAME_MAX = 20
export const ACCOUNT_BANK_MAX = 20
export const ACCOUNT_NUMBER_MAX = 30
export const ACCOUNT_HOLDER_MAX = 60
// 목록 상한. 넘치면 truncated다.
export const ACCOUNT_LIST_LIMIT = 100

export const ACCOUNT_TYPES = ['main', 'business'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

// 통장에 적힌 대로 숫자와 '-'만 받는다. 숫자가 하나는 있어야 한다.
const accountNumber = token(ACCOUNT_NUMBER_MAX).regex(/^[0-9-]*[0-9][0-9-]*$/)

// 계좌 만들기와 고치기(재정부). 고치기도 칸을 모두 받아 그대로 바꾼다.
const fields = {
  name: text(ACCOUNT_NAME_MAX),
  bank: text(ACCOUNT_BANK_MAX),
  accountNumber,
  holder: text(ACCOUNT_HOLDER_MAX),
  type: z.enum(ACCOUNT_TYPES),
}
export const CreateAccountSchema = z.strictObject(fields)
export type CreateAccountRequest = z.infer<typeof CreateAccountSchema>
export const UpdateAccountSchema = z.strictObject(fields)
export type UpdateAccountRequest = z.infer<typeof UpdateAccountSchema>
// 닫기는 본문이 없다. 닫은 날은 서버가 한국 오늘로 적는다.
export const CloseAccountSchema = EmptyRequestSchema

// 계좌마다 서버가 주는 할 수 있는 동작. 닫은 계좌는 아무것도 없고, 완료 전 행사의 신청 양식이 쓰는 계좌는 닫기가 없다(RULE-34, DEC-38).
// 이름은 권한 키(finance.manage)와 떼어 둔다.
export const ACCOUNT_ACTIONS = ['account.update', 'account.close'] as const
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number]

export interface AccountItem {
  id: string
  name: string
  bank: string
  accountNumber: string
  holder: string
  type: AccountType
  // 닫은 날(한국 날짜 YYYY-MM-DD). 닫지 않았으면 null이다.
  closedOn: string | null
  // 이 계좌를 참가비 받는 계좌로 가리키는, 완료하지 않은 행사의 신청 양식 수(멈춤·마감 포함)
  formsInUse: number
  actions: AccountAction[]
}

// 닫지 않은 것(대표 먼저, 이름 순) 뒤에 닫은 것(최근에 닫은 순)
export interface AccountsResponse {
  accounts: AccountItem[]
  truncated: boolean
}
export interface AccountResponse {
  account: AccountItem
}
