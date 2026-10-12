import { useCallback, useEffect, useState } from 'react'
import type { EventReportResponse, SaveRetrospectiveRequest } from '@vada/contracts'
import { reportMessage } from './record-view'

export type ReportResult = { ok: true } | { ok: false; code: string | null; message: string }
const isReport = (body: unknown): body is EventReportResponse => typeof body === 'object' && body !== null
  && typeof (body as EventReportResponse).event === 'object' && (body as EventReportResponse).event !== null
  && typeof (body as EventReportResponse).facts === 'object' && (body as EventReportResponse).facts !== null
  && Array.isArray((body as EventReportResponse).timeline)

// 결과보고서 화면을 열면 불러온다. 회고를 만들거나 고치거나 확인하면 같은 모양의 응답으로 바꾸고 새로 그린다(revision).
export function useEventReport(organizationId: string, eventId: string) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/report`
  const [data, setData] = useState<EventReportResponse | null>(null)
  const [revision, setRevision] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const accept = useCallback((body: EventReportResponse) => {
    setData(body)
    setRevision(value => value + 1)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isReport(body)) throw new Error('Report lookup failed')
        if (!controller.signal.aborted) accept(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, attempt, accept])
  async function send(path: string, body: unknown): Promise<ReportResult> {
    try {
      const response = await fetch(`${url}/retrospective${path}`, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (response.ok && isReport(result)) {
        accept(result)
        return { ok: true }
      }
      const code = (result as { error?: unknown } | null)?.error
      const known = typeof code === 'string' ? code : null
      return { ok: false, code: known, message: reportMessage(known) }
    } catch {
      // 응답을 못 받았어도 서버는 바꿨을 수 있다(끼룩이는 1분 넘게 걸리기도 한다). 새로 불러오게 한다.
      return { ok: false, code: 'UNKNOWN', message: '결과를 확인하지 못했어요. 새로 불러와 주세요.' }
    }
  }
  return { data, revision, loadError, refresh: () => setAttempt(value => value + 1),
    generate: (version: number) => send('/generate', { version }),
    save: (input: SaveRetrospectiveRequest) => send('', input),
    confirm: (version: number) => send('/confirm', { version }) }
}
export type EventReportHook = ReturnType<typeof useEventReport>
