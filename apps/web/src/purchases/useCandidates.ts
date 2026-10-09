import { useCallback, useEffect, useRef, useState } from 'react'
import type { PurchaseCandidate, PurchaseCandidateResponse, PurchaseCandidatesResponse } from '@vada/contracts'
import { messageOf, purchaseFailure } from './purchase-view'

const POLL_MS = 5000
const isList = (body: unknown): body is PurchaseCandidatesResponse =>
  typeof body === 'object' && body !== null && Array.isArray((body as PurchaseCandidatesResponse).candidates)

// 행사의 후보. enabled면 불러오고, live면 5초마다 새로 불러온다(새 링크·숨김·요청됨·조회 완료).
export function useCandidates(organizationId: string, eventId: string, enabled: boolean, live: boolean) {
  const base = `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/purchase-candidates`
  const [candidates, setCandidates] = useState<PurchaseCandidate[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // 목록을 받은 횟수. 링크 패널이 연 뒤 새 목록을 받았는지 볼 때 쓴다.
  const [loads, setLoads] = useState(0)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const active = useRef(true)
  // 불러오는 사이에 숨김을 바꿨으면 늦게 온 목록을 버리고 다시 불러온다.
  const changes = useRef(0)
  // 요청이 진행 중인지. 폴링은 이 요청을 끊지 않고 다음 차례로 넘긴다.
  const loading = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const started = changes.current
    loading.current = true
    void (async () => {
      try {
        const response = await fetch(base, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isList(body)) throw new Error('Candidates lookup failed')
        if (controller.signal.aborted) return
        if (started !== changes.current) { setAttempt(value => value + 1); return }
        setCandidates(body.candidates)
        setTruncated(body.truncated === true)
        setLoadError(false)
        setLoads(value => value + 1)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      } finally {
        if (!controller.signal.aborted) loading.current = false
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  useEffect(() => {
    if (!enabled || !live) return
    // 보는 동안만 부른다. 페이지가 가려져 있거나 앞 요청이 아직 오지 않았으면 이번 차례를 건너뛴다.
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden' && !loading.current) setAttempt(value => value + 1)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [enabled, live])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  async function setHidden(candidate: PurchaseCandidate, hidden: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
    setBusy(true)
    try {
      const response = await fetch(`${base}/${encodeURIComponent(candidate.id)}/hidden`, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden }) })
      const result = await response.json().catch(() => null) as (Partial<PurchaseCandidateResponse> & { error?: unknown }) | null
      if (!response.ok || !result?.candidate) return { ok: false, message: messageOf(result?.error) }
      const next = result.candidate
      changes.current++
      if (active.current) setCandidates(previous => previous?.map(item => item.id === next.id ? next : item) ?? previous)
      return { ok: true }
    } catch {
      return { ok: false, message: purchaseFailure }
    } finally {
      if (active.current) setBusy(false)
    }
  }
  return { candidates, truncated, loadError, loads, busy, refresh, setHidden }
}
export type Candidates = ReturnType<typeof useCandidates>
