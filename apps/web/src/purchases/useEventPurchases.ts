import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeNeededByRequest, EventPurchaseItemsResponse, PurchaseItemDetail, PurchaseItemResponse, PurchaseItemsResponse,
  PurchaseItemSummary, UpdatePurchaseItemRequest } from '@vada/contracts'
import { messageOf, purchaseFailure, staleCodes } from './purchase-view'

// stale: 다른 곳에서 먼저 바뀌어 목록을 새로 불러온 실패다.
export type PurchaseResult = { ok: true; items: PurchaseItemSummary[] } | { ok: false; message: string; stale?: boolean }
const hasItems = (body: unknown): body is PurchaseItemsResponse =>
  typeof body === 'object' && body !== null && Array.isArray((body as PurchaseItemsResponse).items)
const ref = (item: PurchaseItemSummary) => ({ id: item.id, version: item.version })
export const purchaseItemsBase = (organizationId: string, eventId: string) =>
  `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/purchase-items`

// 행사 화면과 구매 검토 화면이 같이 쓴다. 실패하면 null이다.
export async function fetchItemDetail(organizationId: string, eventId: string, itemId: string): Promise<PurchaseItemDetail | null> {
  try {
    const response = await fetch(`${purchaseItemsBase(organizationId, eventId)}/${encodeURIComponent(itemId)}`, { credentials: 'same-origin', cache: 'no-store' })
    const body = await response.json() as Partial<PurchaseItemResponse> | null
    return response.ok && body?.item ? body.item : null
  } catch {
    return null
  }
}

// enabled가 거짓이면 불러오지 않는다. 구매 탭을 처음 열 때 켠다.
export function useEventPurchases(organizationId: string, eventId: string, enabled: boolean) {
  const base = purchaseItemsBase(organizationId, eventId)
  const [items, setItems] = useState<PurchaseItemSummary[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)
  const active = useRef(true)
  const retry = useRef<{ payload: string; key: string } | null>(null)
  // 목록을 불러오는 사이에 바뀐 품목이 있었는지 센다. 늦게 온 목록이 방금 저장한 결과를 덮지 않게 한다.
  const changes = useRef(0)
  // 개발 모드(StrictMode)는 effect를 정리했다 다시 실행한다. 다시 실행될 때 true로 돌려놓는다.
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const started = changes.current
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(base, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !hasItems(body)) throw new Error('Purchase items lookup failed')
        if (controller.signal.aborted) return
        if (started !== changes.current) { setAttempt(value => value + 1); return }
        setItems(body.items)
        setTruncated((body as EventPurchaseItemsResponse).truncated === true)
        // 사라졌거나 제출된 품목은 고른 목록에서 뺀다.
        setSelected(previous => previous.filter(id => body.items.some(item => item.id === id && item.status === 'draft')))
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  // 바뀐 품목을 ID로 합친다. 새 품목은 맨 앞에 둔다(최신순 목록).
  function merge(changed: PurchaseItemSummary[], removed: string[] = []) {
    changes.current++
    setItems(previous => {
      const kept = (previous ?? []).filter(item => !removed.includes(item.id)).map(item => changed.find(next => next.id === item.id) ?? item)
      return [...changed.filter(next => !kept.some(item => item.id === next.id)), ...kept]
    })
  }
  async function send(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<PurchaseResult> {
    setBusy(true)
    try {
      const response = await fetch(`${base}${path}`, { method, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const code = (result as { error?: unknown } | null)?.error
        // 다른 곳에서 먼저 바뀌었으면 화면이 오래된 것이다. 목록을 새로 불러온다.
        const stale = typeof code === 'string' && staleCodes.has(code)
        if (stale) refresh()
        return { ok: false, message: messageOf(code), stale }
      }
      return hasItems(result) ? { ok: true, items: result.items } : { ok: false, message: purchaseFailure }
    } catch {
      return { ok: false, message: purchaseFailure }
    } finally {
      if (active.current) setBusy(false)
    }
  }
  async function apply(pending: Promise<PurchaseResult>, after?: (items: PurchaseItemSummary[]) => void) {
    const result = await pending
    if (result.ok && active.current) { merge(result.items); after?.(result.items) }
    return result
  }
  const detail = useCallback((itemId: string) => fetchItemDetail(organizationId, eventId, itemId), [organizationId, eventId])
  return {
    items, truncated, loadError, busy, generating, selected, setSelected, refresh, detail,
    async create(candidateIds: string[]) {
      const payload = JSON.stringify(candidateIds)
      // 같은 후보로 다시 시도하면 같은 키를 써서 두 번 만들지 않는다.
      if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() }
      setGenerating(true)
      try {
        const result = await apply(send('POST', '/drafts', { idempotencyKey: retry.current.key, candidateIds }),
          created => setSelected(created.filter(item => item.status === 'draft').map(item => item.id)))
        if (result.ok) retry.current = null
        return result
      } finally {
        if (active.current) setGenerating(false)
      }
    },
    update: (item: PurchaseItemSummary, fields: Omit<UpdatePurchaseItemRequest, 'version'>) =>
      apply(send('PATCH', `/${encodeURIComponent(item.id)}`, { version: item.version, ...fields })),
    async remove(item: PurchaseItemSummary) {
      const result = await send('POST', `/${encodeURIComponent(item.id)}/delete`, { version: item.version })
      if (result.ok && active.current) { merge([], [item.id]); setSelected(previous => previous.filter(id => id !== item.id)) }
      return result
    },
    submit: (targets: PurchaseItemSummary[]) => apply(send('POST', '/submit', { items: targets.map(ref) }), () => setSelected([])),
    changeNeededBy: (targets: PurchaseItemSummary[], neededBy: ChangeNeededByRequest['neededBy']) =>
      apply(send('POST', '/needed-by', { items: targets.map(ref), neededBy })),
    cancel: (item: PurchaseItemSummary) => apply(send('POST', `/${encodeURIComponent(item.id)}/cancel`, { version: item.version })),
    reAdd: (item: PurchaseItemSummary) => apply(send('POST', `/${encodeURIComponent(item.id)}/re-add`, { version: item.version })),
    setReceived: (item: PurchaseItemSummary, received: boolean) =>
      apply(send('POST', `/${encodeURIComponent(item.id)}/received`, { version: item.version, received })),
  }
}
export type EventPurchases = ReturnType<typeof useEventPurchases>
