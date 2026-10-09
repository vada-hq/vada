import type { CreateIncomeRequest, IncomeDetail, IncomeResponse, UpdateIncomeRequest, VoidIncomeRequest } from '@vada/contracts'
import { incomeFailure, incomeMessage } from './income-view'

export type IncomeResult = { ok: true; income: IncomeDetail } | { ok: false; message: string }
// 수입은 회계 기간 하나에 속한다.
export const incomesBase = (organizationId: string, periodId: string) =>
  `/api/organizations/${encodeURIComponent(organizationId)}/budget/periods/${encodeURIComponent(periodId)}/incomes`
const isIncome = (body: unknown): body is IncomeResponse => typeof body === 'object' && body !== null
  && typeof (body as IncomeResponse).income === 'object' && (body as IncomeResponse).income !== null && Array.isArray((body as IncomeResponse).income.history)

async function send(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<IncomeResult> {
  try {
    const response = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result: unknown = await response.json().catch(() => null)
    if (response.ok && isIncome(result)) return { ok: true, income: result.income }
    return { ok: false, message: incomeMessage((result as { error?: unknown } | null)?.error) }
  } catch {
    return { ok: false, message: incomeFailure }
  }
}
const one = (organizationId: string, periodId: string, incomeId: string) => `${incomesBase(organizationId, periodId)}/${encodeURIComponent(incomeId)}`

export const createIncome = (organizationId: string, periodId: string, input: CreateIncomeRequest) =>
  send(incomesBase(organizationId, periodId), 'POST', input)
export const updateIncome = (organizationId: string, periodId: string, incomeId: string, input: UpdateIncomeRequest) =>
  send(one(organizationId, periodId, incomeId), 'PATCH', input)
export const voidIncome = (organizationId: string, periodId: string, incomeId: string, input: VoidIncomeRequest) =>
  send(`${one(organizationId, periodId, incomeId)}/void`, 'POST', input)
// 상세. 못 받으면 null이다.
export async function fetchIncome(organizationId: string, periodId: string, incomeId: string): Promise<IncomeDetail | null> {
  try {
    const response = await fetch(one(organizationId, periodId, incomeId), { credentials: 'same-origin', cache: 'no-store' })
    const body: unknown = await response.json()
    return response.ok && isIncome(body) ? body.income : null
  } catch {
    return null
  }
}
