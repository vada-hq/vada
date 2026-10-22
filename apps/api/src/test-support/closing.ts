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

// 앞 기간(2026-03-01~2026-08-31)과 뒤 기간(2026-09-01~2026-11-30, 시험 기수가 2026-12-31에 끝나므로 budgetOf의 끝일을 줄인다)을 만들어 잇는다.
export async function twoPeriods(t: SettlementKit) {
  const { period: next, budget: nextBudget } = await t.budgetOf()
  await t.pg.query("UPDATE fiscal_period SET ends_on = '2026-11-30' WHERE id = $1", [next])
  const first = await t.make(t.council, 'fiscal_period', {
    name: '2026-1',
    startsOn: '2026-03-01',
    endsOn: '2026-08-31',
  })
  const firstBudget = await t.make(t.council, 'budget', { fiscalPeriodId: first })
  await t.pg.query('UPDATE fiscal_period SET previous_period_id = $1 WHERE id = $2', [first, next])
  return { first, firstBudget, next, nextBudget }
}

export const publish = (t: SettlementKit, periodId: string, user = FINANCE) =>
  t.api.post(`${closingPath(t, periodId)}/publish`, {}, user)

export const reopen = (t: SettlementKit, periodId: string, reason = '감사 지적', user = FINANCE) =>
  t.api.post(`${closingPath(t, periodId)}/reopen`, { reason }, user)

export const errorOf = async (response: Response) =>
  ((await response.json()) as { error?: string }).error

// record와 판의 수. 실패한 요청이 아무것도 쓰지 않았는지 본다.
export const writesOf = async (t: SettlementKit) =>
  JSON.stringify([
    (await t.pg.query('SELECT count(*)::int AS n FROM record')).rows,
    (await t.pg.query('SELECT count(*)::int AS n FROM record_version')).rows,
  ])
