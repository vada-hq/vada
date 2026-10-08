import { useCallback, useEffect, useRef, useState } from 'react'
import type { PurchaseItemsResponse, PurchaseItemSummary, PurchaseReviewResponse } from '@vada/contracts'
import { messageOf, purchaseFailure, staleCodes } from './purchase-view'
import type { PurchaseResult } from './useEventPurchases'

const isReview = (body: unknown): body is PurchaseReviewResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as PurchaseReviewResponse).pending) && Array.isArray((body as PurchaseReviewResponse).approved)

// 구매 승인 권한이 있을 때만 켠다. 옆 메뉴의 대기 수를 세려고 학생회를 열 때 불러온다.
export function usePurchaseReview(organizationId: string, enabled: boolean) {
  const base = `/api/organizations/${encodeURIComponent(organizationId)}/purchase-review`
  const [data, setData] = useState<PurchaseReviewResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const active = useRef(true)
  // 개발 모드(StrictMode)는 effect를 정리했다 다시 실행한다. 다시 실행될 때 true로 돌려놓는다.
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(base, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isReview(body)) throw new Error('Purchase review lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  async function send(path: string, body: unknown): Promise<PurchaseResult> {
    setBusy(true)
    try {
      const response = await fetch(`${base}${path}`, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const code = (result as { error?: unknown } | null)?.error
        if (typeof code === 'string' && staleCodes.has(code)) refresh()
        return { ok: false, message: messageOf(code) }
      }
      // 처리한 품목은 다른 묶음으로 옮겨 가므로 목록을 새로 불러온다.
      refresh()
      const items = (result as Partial<PurchaseItemsResponse> | null)?.items
      return Array.isArray(items) ? { ok: true, items } : { ok: false, message: purchaseFailure }
    } catch {
      return { ok: false, message: purchaseFailure }
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return {
    data, loadError, busy, refresh,
    approve: (items: PurchaseItemSummary[]) => send('/decisions', { decisions: items.map(item => ({ id: item.id, version: item.version, decision: 'approved' })) }),
    reject: (item: PurchaseItemSummary, reason: string) => send('/decisions', { decisions: [{ id: item.id, version: item.version, decision: 'rejected', reason }] }),
    revoke: (item: PurchaseItemSummary) => send(`/${encodeURIComponent(item.id)}/revoke`, { version: item.version }),
    setPurchased: (item: PurchaseItemSummary, purchased: boolean) => send(`/${encodeURIComponent(item.id)}/purchased`, { version: item.version, purchased }),
  }
}
export type PurchaseReview = ReturnType<typeof usePurchaseReview>
