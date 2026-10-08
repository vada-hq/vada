import { useEffect, useRef, useState } from 'react'
import type { DeliveryCarriersResponse, DeliveryLookupRequest, DeliveryLookupResponse, RegisterShipmentRequest, UnlinkShipmentRequest } from '@vada/contracts'

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}
type Carrier = DeliveryCarriersResponse['carriers'][number]
// 택배사 목록은 거의 바뀌지 않는다. 외부 조회는 사용자별 분당 횟수 제한이 있어, 화면을 열 때마다 다시 받지 않도록 학생회별로 잠시 보관한다.
export const carrierCache = new Map<string, { at: number; carriers: Carrier[] }>()
const CARRIER_CACHE_MS = 10 * 60_000

function explain(cause: unknown) {
  if (!(cause instanceof ApiError)) return '처리 결과를 확인하지 못했어요. 목록을 새로 불러온 뒤 다시 시도해 주세요.'
  if ([401, 403].includes(cause.status)) return '배송 정보에 접근할 수 없어요. 로그인·소속을 확인해 주세요.'
  if (cause.code === 'DELIVERY_NOT_FOUND') return '송장을 찾을 수 없어요. 택배사와 송장번호를 확인해 주세요.'
  if (cause.status === 429) return '조회 요청이 많아요. 잠시 후 다시 시도해 주세요.'
  if (cause.status === 502) return '택배 조회 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
  if (cause.status === 503) return '서버의 배송 조회 설정을 확인해 주세요.'
  if (cause.code === 'PURCHASE_NOT_APPROVED') return '승인된 품목만 등록할 수 있어요. 목록을 새로 불러와 주세요.'
  if (cause.code === 'IDEMPOTENCY_CONFLICT') return '입력이 바뀌었어요. 송장을 다시 조회한 뒤 등록해 주세요.'
  if (cause.status === 400) return '택배사와 송장번호를 확인해 주세요. 송장번호는 영문·숫자·하이픈만 쓸 수 있어요.'
  if (cause.status === 404) return '대상을 찾을 수 없어요. 목록을 새로 불러와 주세요.'
  return '처리 결과를 확인하지 못했어요. 목록을 새로 불러온 뒤 다시 시도해 주세요.'
}

// 구매 검토 화면의 송장 등록·해제. 서버에서 배송 기능이 꺼져 있으면 available이 false가 된다.
export function useDeliveries(organizationId: string, enabled: boolean) {
  const root = `/api/organizations/${encodeURIComponent(organizationId)}`
  // null은 아직 모르는 상태다.
  const [available, setAvailable] = useState<boolean | null>(null)
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const controller = useRef<AbortController | null>(null)
  const lock = useRef(false)
  const retry = useRef<{ payload: string; key: string } | null>(null)

  async function request<T>(url: string, signal: AbortSignal, body?: unknown): Promise<T> {
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string }
      throw new ApiError(response.status, result.error ?? '')
    }
    return await response.json() as T
  }
  async function loadCarriers(signal: AbortSignal, search = '') {
    const cached = search ? undefined : carrierCache.get(root)
    if (cached && Date.now() - cached.at < CARRIER_CACHE_MS) { setCarriers(cached.carriers); return }
    const found: Carrier[] = []
    let after: string | null = null
    // 외부 목록은 한 번에 20개만 온다. 롯데·로젠 등 주요 택배사가 뒤 페이지에 있어 끝까지 받는다.
    for (let page = 0; page < 5; page++) {
      const query = new URLSearchParams()
      if (search) query.set('search', search)
      if (after) query.set('after', after)
      const result: DeliveryCarriersResponse = await request(`${root}/delivery-carriers${query.size ? `?${query}` : ''}`, signal)
      if (!Array.isArray(result.carriers)) throw new Error('Invalid response')
      found.push(...result.carriers)
      after = result.nextCursor
      if (!after) break
    }
    // 국내 택배사를 먼저 보여 준다. 그 안의 순서는 외부 목록 순서를 유지한다.
    const domestic = (carrier: Carrier) => carrier.id.startsWith('kr.')
    const sorted = [...found.filter(domestic), ...found.filter(carrier => !domestic(carrier))]
    if (!search) carrierCache.set(root, { at: Date.now(), carriers: sorted })
    if (!signal.aborted) setCarriers(sorted)
  }
  async function run<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    const current = controller.current
    if (!current || current.signal.aborted || lock.current) return null
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { return await action(current.signal) }
    catch (cause) {
      if (!current.signal.aborted) setError(explain(cause))
      return null
    } finally {
      if (!current.signal.aborted) { lock.current = false; setBusy(false) }
    }
  }
  useEffect(() => {
    if (!enabled) return
    const current = new AbortController()
    controller.current = current; lock.current = true; setBusy(true)
    void (async () => {
      try {
        await loadCarriers(current.signal)
        if (!current.signal.aborted) setAvailable(true)
      } catch (cause) {
        if (current.signal.aborted) return
        // 라우트가 연결되지 않은 서버는 404로 답한다. 배송 기능이 꺼진 것이므로 송장 칸을 숨긴다.
        if (cause instanceof ApiError && cause.status === 404) setAvailable(false)
        else { setAvailable(true); setError(explain(cause)) }
      } finally {
        if (!current.signal.aborted) { lock.current = false; setBusy(false) }
      }
    })()
    return () => { current.abort() }
    // 학생회가 바뀌면 상위 컴포넌트 key로 새로 만든다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return {
    available, carriers, busy, error, notice,
    searchCarriers: (search: string) => { void run(signal => loadCarriers(signal, search)) },
    lookup: (input: DeliveryLookupRequest) => run(signal => request<DeliveryLookupResponse>(`${root}/delivery-lookups`, signal, input)),
    register: async (input: DeliveryLookupRequest, purchaseItemIds: string[]) => Boolean(await run(async signal => {
      const payload = JSON.stringify([input.carrierId, input.trackingNumber, purchaseItemIds])
      // 같은 등록 의도의 재시도는 같은 키를 써서 중복 등록을 막는다.
      if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() }
      const body: RegisterShipmentRequest = { ...input, purchaseItemIds, idempotencyKey: retry.current.key }
      await request(`${root}/shipments`, signal, body)
      retry.current = null
      if (!signal.aborted) setNotice('송장을 등록했어요. 배송 상태는 자동으로 갱신돼요.')
      return true
    })),
    unlink: async (shipmentId: string, linkId: string) => Boolean(await run(async signal => {
      const body: UnlinkShipmentRequest = { linkIds: [linkId] }
      await request(`${root}/shipments/${encodeURIComponent(shipmentId)}/unlink`, signal, body)
      if (!signal.aborted) setNotice('송장 연결을 해제했어요.')
      return true
    })),
  }
}
