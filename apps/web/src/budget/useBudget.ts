import { useCallback, useEffect, useState } from 'react'
import type { BudgetPeriodsResponse, BudgetPlanResponse, CreateBudgetPeriodRequest, SaveBudgetPlanRequest } from '@vada/contracts'
import { budgetFailure, budgetMessage } from './budget-view'

export type BudgetResult = { ok: true; plan: BudgetPlanResponse } | { ok: false; message: string }
const periodsBase = (organizationId: string) => `/api/organizations/${encodeURIComponent(organizationId)}/budget/periods`
const isPeriods = (body: unknown): body is BudgetPeriodsResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as BudgetPeriodsResponse).periods)
const isPlan = (body: unknown): body is BudgetPlanResponse => typeof body === 'object' && body !== null
  && typeof (body as BudgetPlanResponse).period === 'object' && Array.isArray((body as BudgetPlanResponse).events)

// 같은 꼴의 GET 하나를 불러온다. 주소가 바뀌면 이전 응답을 버린다.
function useLoad<T>(url: string | null, accept: (body: unknown) => body is T) {
  const [state, setState] = useState<{ url: string; data: T } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (url === null) return
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !accept(body)) throw new Error('Budget lookup failed')
        if (!controller.signal.aborted) setState({ url, data: body })
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, accept, attempt])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  const replace = (data: T) => { if (url !== null) setState({ url, data }) }
  return { data: state && state.url === url ? state.data : null, loadError, refresh, replace }
}

// 기간 목록. 예산 화면과 지출 대화상자(운영 항목 고르기)가 쓴다.
export function useBudgetPeriods(organizationId: string, enabled: boolean) {
  const { data, loadError, refresh } = useLoad(enabled ? periodsBase(organizationId) : null, isPeriods)
  return { data, loadError, refresh }
}

async function send(url: string, body: unknown): Promise<BudgetResult> {
  try {
    const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body) })
    const result: unknown = await response.json().catch(() => null)
    if (response.ok && isPlan(result)) return { ok: true, plan: result }
    return { ok: false, message: budgetMessage((result as { error?: unknown } | null)?.error) }
  } catch {
    return { ok: false, message: budgetFailure }
  }
}

// 한 기간의 편성. 저장하면 받은 응답으로 바꾸고, 실패하면 새로 불러온다.
export function useBudgetPlan(organizationId: string, periodId: string | null) {
  const url = periodId === null ? null : `${periodsBase(organizationId)}/${encodeURIComponent(periodId)}`
  const { data, loadError, refresh, replace } = useLoad(url, isPlan)
  async function save(input: SaveBudgetPlanRequest): Promise<BudgetResult> {
    if (url === null) return { ok: false, message: budgetFailure }
    const result = await send(`${url}/plan`, input)
    if (result.ok) replace(result.plan)
    else refresh()
    return result
  }
  return { data, loadError, refresh, save }
}
export type BudgetPlanState = ReturnType<typeof useBudgetPlan>

export const createBudgetPeriod = (organizationId: string, input: CreateBudgetPeriodRequest) => send(periodsBase(organizationId), input)
// 결산서 엑셀 주소. 구성원 누구나 받는다.
export const budgetExportUrl = (organizationId: string, periodId: string) => `${periodsBase(organizationId)}/${encodeURIComponent(periodId)}/export`
