import type { AccountItem, AccountType } from '@vada/contracts'

// 계좌 더하기·고치기 폼의 값. 입력칸 값은 글자다.
export type AccountValues = {
  name: string
  bank: string
  accountNumber: string
  holder: string
  type: AccountType
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  main: '대표 계좌',
  business: '사업용 계좌',
}

// 닫을 수 없는 까닭: 완료하지 않은 행사의 신청 양식이 참가비 받는 계좌로 쓴다(RULE-34).
export const ACCOUNT_IN_USE_LABEL = (count: number) => `신청 양식 ${count}개에서 사용 중`

export const emptyAccount = (): AccountValues => ({
  name: '',
  bank: '',
  accountNumber: '',
  holder: '',
  type: 'business',
})

export const valuesOfAccount = (account: AccountItem): AccountValues => ({
  name: account.name,
  bank: account.bank,
  accountNumber: account.accountNumber,
  holder: account.holder,
  type: account.type,
})

// 닫지 않은 계좌만 새 지출에 고를 수 있다.
export const openAccounts = (accounts: AccountItem[]) =>
  accounts.filter(account => account.closedOn === null)

// 지출 적기가 채우는 계좌: 닫지 않은 대표 계좌(DEC-45).
const mainAccountOf = (accounts: AccountItem[]) =>
  openAccounts(accounts).find(account => account.type === 'main') ?? null

// 지출 적기의 계좌. 고르지 않았으면(undefined) 닫지 않은 대표 계좌로 보고, '없음'(null)이면 비운다.
// 상태에 채워 넣지 않고 그때그때 구하므로 목록이 늦게 와도 다른 칸을 바꾸는 일과 겹치지 않는다.
// 고른 계좌가 목록에서 닫혔으면 비우고 closed로 알린다. 목록을 아직 못 읽었으면 고른 그대로다.
export function pickAccount(chosen: string | null | undefined, accounts: AccountItem[] | null) {
  if (accounts === null) return { id: chosen ?? null, closed: false }
  if (chosen === undefined) return { id: mainAccountOf(accounts)?.id ?? null, closed: false }
  if (chosen === null) return { id: null, closed: false }
  const open = openAccounts(accounts).some(account => account.id === chosen)
  return { id: open ? chosen : null, closed: !open }
}
