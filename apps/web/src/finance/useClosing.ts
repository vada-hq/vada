import { useRef, useState } from 'react'
import { statusOf, type ClosingResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { CLOSING_ERRORS, CLOSING_FAILED, CLOSING_LOST, PERMISSION_CHANGED } from '@/lib/messages'
import { useLatest } from '@/lib/use-latest'
import { usePolledRead } from '@/lib/use-polled-read'
import { closingPath, closingPublishPath, closingReopenPath } from './closing-api'

// 한 기간의 결산서. 기간을 고르기 전(null)이나 공개 전 재정부가 아니면(enabled가 false) 읽지 않는다. 화면이 보이는 동안 15초마다 다시 읽는다.
// 권한이 바뀌었으면(403) 학생회를 다시 읽게 하고, 기간이 사라졌으면(404) 이유를 남긴다.
export function useClosing(
  councilId: string,
  periodId: string | null,
  enabled: boolean,
  onForbidden: () => void,
) {
  const [gone, setGone] = useState<string | null>(null)
  const read = usePolledRead<ClosingResponse>(
    periodId === null ? '' : closingPath(councilId, periodId),
    status => {
      if (status === statusOf('FORBIDDEN')) onForbidden()
      if (status === statusOf('NOT_FOUND')) setGone(periodId)
    },
    enabled && periodId !== null,
  )
  return { ...read, lost: gone !== null && gone === periodId }
}
export type ClosingRead = ReturnType<typeof useClosing>

// 결과: 바뀌었다(done), 이미 바뀐 상태라 다시 읽었다(stale), 아무것도 바꾸지 못했다(failed).
export type ClosingOutcome = 'done' | 'stale' | 'failed'

// 이미 바뀐 상태라 다시 읽어야 하는 거절. 이때 서버가 주는 동작이 달라진다.
const STALE_CODES = [
  'CLOSING_PUBLISHED',
  'CLOSING_NOT_PUBLISHED',
  'NEXT_PERIOD_CLOSED',
  'PERIOD_NOT_ENDED',
  'PREVIOUS_PERIOD_OPEN',
  'CLOSING_NEGATIVE',
  'FEE_INCOME_PENDING',
]

function problemOf(status: number, code: string) {
  if (status === statusOf('FORBIDDEN')) return PERMISSION_CHANGED
  if (status === statusOf('NOT_FOUND')) return CLOSING_LOST
  return CLOSING_ERRORS[code] ?? CLOSING_FAILED
}

type Handlers = { onChanged: () => void; onForbidden: () => void }

// 공개와 다시 열기. 요청은 한 번에 하나만 나간다. 거절의 문구는 그 동작 옆에 보인다.
export function useClosingChange(
  councilId: string,
  periodId: string,
  read: Pick<ClosingRead, 'replace' | 'reload'>,
  handlers: Handlers,
) {
  const latest = useLatest(handlers)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)

  async function send(path: string, body: object): Promise<ClosingOutcome> {
    if (sending.current) return 'failed'
    sending.current = true
    setSaving(true)
    setProblem(null)
    const result = await postJson<ClosingResponse>(path, body)
    sending.current = false
    setSaving(false)
    if (result.ok) {
      read.replace(result.data)
      latest.current.onChanged()
      return 'done'
    }
    setProblem(problemOf(result.status, result.code))
    if (result.status === statusOf('FORBIDDEN')) latest.current.onForbidden()
    const lost = result.status === statusOf('FORBIDDEN') || result.status === statusOf('NOT_FOUND')
    if (!lost && !STALE_CODES.includes(result.code)) return 'failed'
    latest.current.onChanged()
    await read.reload()
    return 'stale'
  }

  return {
    saving,
    problem,
    report: setProblem,
    publish: () => send(closingPublishPath(councilId, periodId), {}),
    reopen: (reason: string) => send(closingReopenPath(councilId, periodId), { reason }),
  }
}
export type ClosingChange = ReturnType<typeof useClosingChange>
