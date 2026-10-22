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
export const mainAccountOf = (accounts: AccountItem[]) =>
  openAccounts(accounts).find(account => account.type === 'main') ?? null
