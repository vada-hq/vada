import type { ClosingResponse, FiscalPeriodsResponse } from '@vada/contracts'
import type { SettlementKit } from './settlement.js'

// 결산서 읽기 시험이 같이 쓰는 도우미. 기간은 2026-09-01~2027-02-28(settlement 시험 도구의 budgetOf).
export const FINANCE = 's-financeMember'

export const closingPath = (t: SettlementKit, periodId: string, councilId = t.council.councilId) =>
  `/api/organizations/${councilId}/fiscal-periods/${periodId}/closing`

export const readClosing = async (t: SettlementKit, periodId: string, user = FINANCE) => {
  const response = await t.api.get(closingPath(t, periodId), user)
  if (response.status !== 200) throw new Error(`결산서 읽기 ${response.status}`)
  return ((await response.json()) as ClosingResponse).closing
}

export const readPeriods = async (t: SettlementKit, user = FINANCE) => {
  const response = await t.api.get(`/api/organizations/${t.council.councilId}/fiscal-periods`, user)
  if (response.status !== 200) throw new Error(`기간 목록 ${response.status}`)
  return ((await response.json()) as FiscalPeriodsResponse).periods
}

// 이 학생회의 지출 한 건. 결제 시각을 그대로 준다(한국 날짜 경계를 시험하려고).
export const spend = (t: SettlementKit, paidAt: string, amount: number, values = {}) =>
  t.expense({ paidAt: new Date(paidAt), amount: String(amount), ...values })

export const earn = (
  t: SettlementKit,
  periodId: string,
  amount: number,
  values: Record<string, unknown> = {},
) =>
  t.make(t.council, 'income', {
    fiscalPeriodId: periodId,
    source: 'fee',
    amount: String(amount),
    receivedOn: '2026-10-21',
    ...values,
  })
