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
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const active = useRef(true)
  // 불러오는 사이에 숨김을 바꿨으면 늦게 온 목록을 버리고 다시 불러온다.
  const changes = useRef(0)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const started = changes.current
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
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [base, enabled, attempt])
  useEffect(() => {
    if (!enabled || !live) return
    const timer = setInterval(() => setAttempt(value => value + 1), POLL_MS)
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
  return { candidates, truncated, loadError, busy, refresh, setHidden }
}
export type Candidates = ReturnType<typeof useCandidates>
