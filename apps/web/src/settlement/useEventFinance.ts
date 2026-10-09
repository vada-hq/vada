import { useCallback, useEffect, useState } from 'react'
import type { EventFinanceResponse, ReopenSettlementRequest, SetEventBudgetRequest } from '@vada/contracts'
import { downloadFile } from '@/lib/download'
import { settlementFailure, settlementMessage } from './settlement-view'

export type FinanceResult = { ok: true } | { ok: false; message: string }
const isFinance = (body: unknown): body is EventFinanceResponse => typeof body === 'object' && body !== null
  && typeof (body as EventFinanceResponse).finance === 'object' && Array.isArray((body as EventFinanceResponse).expenses)
export const financeBase = (organizationId: string, eventId: string) =>
  `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/finance`

// 재정 탭을 열 때 불러온다. 바꾸는 요청은 받은 응답으로 화면을 바꾸고, 실패하면 새로 불러온다.
export function useEventFinance(organizationId: string, eventId: string, enabled: boolean) {
  const base = financeBase(organizationId, eventId)
  const [data, setData] = useState<EventFinanceResponse | null>(null)
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
        if (!response.ok || !isFinance(body)) throw new Error('Event finance lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  async function send(path: string, body: unknown): Promise<FinanceResult> {
    try {
      const response = await fetch(`${base}${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (response.ok && isFinance(result)) {
        setData(result)
        return { ok: true }
      }
      refresh()
      return { ok: false, message: settlementMessage((result as { error?: unknown } | null)?.error) }
    } catch {
      return { ok: false, message: settlementFailure }
    }
  }
  // 정산서 엑셀을 내려받는다.
  async function download(): Promise<FinanceResult> {
    const result = await downloadFile(`${base}/export`, '정산.xlsx')
    return result.ok ? result : { ok: false, message: settlementMessage(result.code) }
  }
  return {
    data, loadError, refresh, download,
    setBudget: (input: SetEventBudgetRequest) => send('/budget', input),
    settle: (version: number) => send('/settle', { version }),
    reopen: (input: ReopenSettlementRequest) => send('/reopen', input),
  }
}
export type EventFinanceState = ReturnType<typeof useEventFinance>
