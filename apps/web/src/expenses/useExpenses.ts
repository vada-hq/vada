import { useCallback, useEffect, useState } from 'react'
import type { CreateExpenseRequest, ExpenseDetail, ExpenseResponse, ExpensesResponse, UpdateExpenseRequest } from '@vada/contracts'
import { expenseFailure, expenseMessage } from './expense-view'

export type ExpenseResult = { ok: true; expense: ExpenseDetail } | { ok: false; message: string }
const isList = (body: unknown): body is ExpensesResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as ExpensesResponse).expenses) && typeof (body as ExpensesResponse).totals === 'object'
export const expensesBase = (organizationId: string) => `/api/organizations/${encodeURIComponent(organizationId)}/expenses`

// 지출을 바꾸는 요청을 보낸다. 성공하면 바뀐 상세를, 실패하면 화면 문구를 돌려준다.
export async function sendExpense(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<ExpenseResult> {
  try {
    const response = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json().catch(() => null) as (Partial<ExpenseResponse> & { error?: unknown }) | null
    if (!response.ok || !result?.expense) return { ok: false, message: expenseMessage(result?.error) }
    return { ok: true, expense: result.expense }
  } catch {
    return { ok: false, message: expenseFailure }
  }
}
// 상세를 연다. 실패하면 null이다.
export async function fetchExpense(organizationId: string, id: string): Promise<ExpenseDetail | null> {
  try {
    const response = await fetch(`${expensesBase(organizationId)}/${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' })
    const body = await response.json() as Partial<ExpenseResponse> | null
    return response.ok && body?.expense ? body.expense : null
  } catch {
    return null
  }
}

// 사용 내역 화면을 열 때 불러온다. 바꾸는 요청은 결과만 돌려주고, 화면이 refresh로 목록을 새로 불러온다.
export function useExpenses(organizationId: string, enabled: boolean) {
  const base = expensesBase(organizationId)
  const [data, setData] = useState<ExpensesResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(base, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isList(body)) throw new Error('Expenses lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  return {
    data, loadError, refresh,
    create: (input: CreateExpenseRequest) => sendExpense(base, 'POST', input),
    update: (id: string, input: UpdateExpenseRequest) => sendExpense(`${base}/${encodeURIComponent(id)}`, 'PATCH', input),
    voidExpense: (id: string, version: number, reason: string) => sendExpense(`${base}/${encodeURIComponent(id)}/void`, 'POST', { version, reason }),
  }
}
export type Expenses = ReturnType<typeof useExpenses>
