import { useCallback, useEffect, useState } from 'react'
import type { EventReportResponse, SaveEventReportRequest } from '@vada/contracts'
import { reportMessage } from './record-view'

export type ReportResult = { ok: true } | { ok: false; code: string | null; message: string }
const isReport = (body: unknown): body is EventReportResponse => typeof body === 'object' && body !== null
  && typeof (body as EventReportResponse).event === 'object' && (body as EventReportResponse).event !== null
  && typeof (body as EventReportResponse).facts === 'object' && (body as EventReportResponse).facts !== null

// 결과보고서 화면을 열면 불러온다. 바꾸는 요청은 같은 모양의 응답을 받아 그대로 바꾼다. revision은 받을 때마다 오른다.
export function useEventReport(organizationId: string, eventId: string) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/report`
  const [data, setData] = useState<EventReportResponse | null>(null)
  const [revision, setRevision] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const accept = useCallback((body: EventReportResponse) => { setData(body); setRevision(value => value + 1) }, [])
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
      const response = await fetch(`${url}${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (response.ok && isReport(result)) {
        accept(result)
        return { ok: true }
      }
      const code = (result as { error?: unknown } | null)?.error
      const known = typeof code === 'string' ? code : null
      return { ok: false, code: known, message: reportMessage(known) }
    } catch {
      // 응답을 못 받았어도 서버는 바꿨을 수 있다. 새로 불러오게 한다.
      return { ok: false, code: 'UNKNOWN', message: '결과를 확인하지 못했어요. 쓴 글을 복사해 두고 새로 불러와 주세요.' }
    }
  }
  return { data, revision, loadError, refresh: () => setAttempt(value => value + 1),
    save: (input: SaveEventReportRequest) => send('', input),
    publish: (version: number) => send('/publish', { version }),
    unpublish: (version: number) => send('/unpublish', { version }) }
}
export type EventReportHook = ReturnType<typeof useEventReport>
