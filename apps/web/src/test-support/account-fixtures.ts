import type { AccountItem, AccountsResponse } from '@vada/contracts'

// 계좌 화면 시험이 같이 쓰는 응답. 값은 서버 응답과 같은 모양이다(번호는 uuid).
export const MAIN_ACCOUNT_ID = '66666666-6666-4666-8666-666666666661'
export const BUSINESS_ACCOUNT_ID = '66666666-6666-4666-8666-666666666662'
export const CLOSED_ACCOUNT_ID = '66666666-6666-4666-8666-666666666663'

export const accountItem = (id: string, extra: Partial<AccountItem> = {}): AccountItem => ({
  id,
  name: '학생회비 통장',
  bank: '국민은행',
  accountNumber: '123-45-678901',
  holder: '소프트웨어학부 학생회',
  type: 'main',
  closedOn: null,
  formsInUse: 0,
  actions: ['account.update', 'account.close'],
  ...extra,
})

export const accountsResponse = (accounts: AccountItem[] = []): AccountsResponse => ({
  accounts,
  truncated: false,
})

export const standardAccounts = () =>
  accountsResponse([
    accountItem(MAIN_ACCOUNT_ID),
    accountItem(BUSINESS_ACCOUNT_ID, { name: '행사 통장', type: 'business', bank: '신한은행' }),
    accountItem(CLOSED_ACCOUNT_ID, {
      name: '지난 통장',
      type: 'business',
      closedOn: '2026-09-01',
      actions: [],
    }),
  ])
