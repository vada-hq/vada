import type { SettlementKit } from './settlement.js'
import { closingPath, earn, spend } from './closing.js'

// 결산서 내보내기 시험이 같이 쓰는 도우미.
export const ACCOUNT_NUMBER = '110-123-456789'
export const HOLDER = '예금주홍길동'
export const NAMES = ['s president', 's financeMember', 's planningMember']

export const exportPath = (t: SettlementKit, periodId: string, type: string) =>
  `${closingPath(t, periodId)}/export?type=${type}`
export const zipPath = (t: SettlementKit, periodId: string) =>
  `${closingPath(t, periodId)}/audit.zip`

// 지출 둘(사용처·내용·사유가 수식처럼 시작한다), 취소한 지출, 수입 둘(하나는 취소), 계좌 하나, 예산 항목 둘.
export async function seedExport(t: SettlementKit) {
  const { period, budget } = await t.budgetOf()
  const expenseItem = await t.budgetItem(budget, { purpose: '비품', amount: '100000' })
  const incomeItem = await t.budgetItem(budget, {
    type: 'income',
    purpose: '학생회비 예산',
    amount: '500000',
  })
  const account = await t.make(t.council, 'account', {
    name: '학생회 통장',
    bank: '국민은행',
    accountNumber: ACCOUNT_NUMBER,
    holder: HOLDER,
    type: 'main',
  })
  const people = {
    paidBy: t.council.people.planningMember.memberId,
    requestedBy: t.council.people.financeMember.memberId,
  }
  await earn(t, period, 300000, {
    budgetItemId: incomeItem,
    accountId: account,
    description: '=HYPERLINK("http://example.test")',
  })
  await earn(t, period, 11, { cancelledAt: new Date('2026-10-22T00:00:00Z') })
  const later = await spend(t, '2026-10-20T00:00:00Z', 30000, {
    vendor: '+문구점',
    description: '@마커',
    budgetItemId: expenseItem,
    accountId: account,
    ...people,
  })
  const earlier = await spend(t, '2026-10-10T00:00:00Z', 5000, {
    vendor: '-식당',
    reason: '=1+1',
    ...people,
  })
  await spend(t, '2026-10-12T00:00:00Z', 777, { cancelledAt: new Date('2026-10-22T00:00:00Z') })
  return { period, account, expenseItem, incomeItem, later, earlier }
}

// 지출에 사진 한 장을 붙인다. 저장소에는 바이트를 둔다.
export async function photoOf(t: SettlementKit, expenseId: string, key: string, body: number[]) {
  const evidence = await t.evidence(expenseId)
  await t.make(t.council, 'file', {
    name: 'evidence.jpg',
    mediaType: 'image/jpeg',
    sizeBytes: body.length,
    storageKey: key,
    attachedToId: evidence,
  })
  t.store.putBody(key, Uint8Array.from(body))
}
