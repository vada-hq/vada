import { useEffect, useRef, useState } from 'react'
import type { DecidePurchaseRequest, PurchaseDetail, PurchaseResponse, PurchaseSummary, PurchasesResponse, SubmitPurchaseRequest, UpdatePurchaseDraftRequest } from '@vada/contracts'

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}
export function usePurchases(organizationId: string, eventId: string, finance = false) {
  const base = `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/purchase-requests${finance ? '/finance' : ''}`
  const [rows, setRows] = useState<PurchaseSummary[]>([])
  const [selected, setSelected] = useState<PurchaseDetail | null>(null)
  const [revision, setRevision] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const controller = useRef<AbortController | null>(null)
  const lock = useRef(false)
  const retry = useRef<{ payload: string; key: string } | null>(null)

  async function request<T>(url: string, signal: AbortSignal, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store', signal,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string }
      throw new ApiError(response.status, result.error ?? '')
    }
    return await response.json() as T
  }
  function accept(value: PurchaseDetail) {
    if (!value?.id || value.organizationId !== organizationId || value.eventId !== eventId || !Array.isArray(value.items)) throw new Error('Invalid response')
    setSelected(value)
    setRevision(value => value + 1)
    setRows(previous => [value, ...previous.filter(row => row.id !== value.id)])
    setStale(false)
  }
  async function run(action: (signal: AbortSignal) => Promise<void>, changing = false) {
    const current = controller.current
    if (!current || current.signal.aborted || lock.current || denied) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await action(current.signal) }
    catch (cause) {
      if (current.signal.aborted) return
      if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
        setSelected(null); setRows([]); setCursor(null); setDenied(true)
        setError('요청서에 접근할 수 없어요. 로그인·소속을 확인해 주세요.')
      } else if (cause instanceof ApiError && cause.status === 404) {
        setSelected(null); setError('요청서를 찾을 수 없어요. 목록을 다시 불러와 주세요.')
      } else if (cause instanceof ApiError && ['VERSION_CONFLICT', 'INVALID_STATE'].includes(cause.code)) {
        setStale(true); setError('다른 곳에서 변경된 요청서예요. 수정 내용을 확인한 뒤 요청서를 다시 불러와 주세요.')
      } else if (cause instanceof ApiError && cause.code === 'AI_NOT_CONFIGURED') {
        setError('서버의 AI 키·모델 설정을 확인해 주세요.')
      } else if (cause instanceof ApiError && cause.code === 'GENERATION_IN_PROGRESS') {
        setError('초안을 생성 중이에요. 잠시 후 같은 링크로 다시 시도해 주세요.')
      } else if (cause instanceof ApiError && cause.code === 'SUBMISSION_INCOMPLETE') {
        setError('제출 필수값을 확인해 주세요. 구매 목적·필요한 날짜·상품명·링크·주문 수량·옵션 확인이 필요해요.')
      } else if (cause instanceof ApiError && cause.code === 'INVALID_REJECTION_REASON') {
        setError('반려 사유를 공백이 아닌 2,000자 이내로 입력해 주세요.')
      } else if (cause instanceof ApiError && cause.status === 400) {
        setError('쿠팡 상품 주소와 입력값을 확인해 주세요. 수량은 양의 정수, 금액은 0 이상이어야 해요.')
      } else {
        if (changing) setStale(true)
        setError(changing ? '처리 결과를 확인하지 못했어요. 다시 시도하기 전에 요청서를 다시 불러와 주세요.' : '처리 결과를 확인하지 못했어요. 목록을 확인하거나 같은 링크로 다시 시도해 주세요.')
      }
    } finally {
      if (!current.signal.aborted) { lock.current = false; setBusy(false); setLoading(false) }
    }
  }
  async function load(signal: AbortSignal, before?: string) {
    const result = await request<PurchasesResponse>(before ? `${base}?before=${encodeURIComponent(before)}` : base, signal)
    if (!Array.isArray(result.requests)) throw new Error('Invalid response')
    if (signal.aborted) return
    setRows(previous => before ? [...previous, ...result.requests.filter(row => !previous.some(known => known.id === row.id))] : result.requests)
    setCursor(result.nextCursor)
  }
  useEffect(() => {
    const current = new AbortController()
    controller.current = current; lock.current = false
    void run(signal => load(signal))
    return () => { current.abort() }
    // 상위 컴포넌트 key로 행사마다 독립된 상태를 만든다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    rows, selected, revision, cursor, busy, loading, denied, stale, error, notice,
    refresh: () => { void run(signal => load(signal)) },
    older: () => { if (cursor) void run(signal => load(signal, cursor)) },
    select: (id: string) => { void run(async signal => {
      const result = await request<PurchaseResponse>(`${base}/${encodeURIComponent(id)}`, signal)
      if (!signal.aborted) accept(result.request)
    }) },
    create: (links: string[]) => { if (finance) return; void run(async signal => {
      const payload = JSON.stringify(links)
      if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() }
      const result = await request<PurchaseResponse>(`${base}/drafts`, signal, 'POST', { links, idempotencyKey: retry.current.key })
      if (!signal.aborted) { accept(result.request); retry.current = null; setNotice('초안을 만들었어요. 내용을 확인해 주세요.') }
    }) },
    save: (input: UpdatePurchaseDraftRequest) => { if (!finance && selected && !stale) void run(async signal => {
      const result = await request<PurchaseResponse>(`${base}/${encodeURIComponent(selected.id)}`, signal, 'PATCH', input)
      if (!signal.aborted) { accept(result.request); setNotice('저장했어요.') }
    }, true) },
    discard: () => { if (!finance && selected && !stale) void run(async signal => {
      const result = await request<PurchaseResponse>(`${base}/${encodeURIComponent(selected.id)}/discard`, signal, 'POST', { version: selected.version })
      if (!signal.aborted) { accept(result.request); setNotice('폐기했어요.') }
    }, true) },
    submit: () => { if (!finance && selected?.status === 'draft' && !stale) void run(async signal => {
      const body: SubmitPurchaseRequest = { version: selected.version }
      const result = await request<PurchaseResponse>(`${base}/${encodeURIComponent(selected.id)}/submit`, signal, 'POST', body)
      if (!signal.aborted) { accept(result.request); setNotice('제출했어요. 접수 상태로 변경되었습니다.') }
    }, true) },
    decide: (decision: 'approved' | 'rejected', reason: string) => {
      if (finance && selected?.status === 'submitted' && !stale) void run(async signal => {
        const body: DecidePurchaseRequest = decision === 'approved'
          ? { version: selected.version, decision } : { version: selected.version, decision, reason: reason.trim() }
        const result = await request<PurchaseResponse>(`${base}/${encodeURIComponent(selected.id)}/decision`, signal, 'POST', body)
        if (!signal.aborted) { accept(result.request); setNotice(decision === 'approved' ? '승인했어요.' : '반려했어요.') }
      }, true)
    },
  }
}
