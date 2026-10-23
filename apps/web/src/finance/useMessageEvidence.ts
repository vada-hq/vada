import { useRef, useState } from 'react'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { chatEvidenceProblem, isStale, reportExpenseLost } from './expense-requests'
import { sendChatEvidence } from './useChatEvidence'
import type { EvidenceHooks } from './useEvidenceUpload'

// 사진 한 장의 붙이기 상태. 아직 누르지 않은 사진은 상태가 없다.
export type PhotoStatus = { state: 'attaching' | 'done' } | { state: 'failed'; problem: string }

// 지출을 적은 그 메시지의 사진들을 차례로 증빙으로 붙인다(조각 1 경로, 사진마다 한 번).
// 처음 실패에서 멈추고, 다시 누르면 붙지 않은 사진부터 이어 붙인다. 붙이는 중에는 다시 받지 않는다.
export function useMessageEvidence(
  councilId: string,
  expenseId: string,
  photoIds: string[],
  hooks: EvidenceHooks,
) {
  const [status, setStatus] = useState<Record<string, PhotoStatus>>({})
  const busy = useRef(false)
  const [attaching, setAttaching] = useState(false)
  const isActive = useActive()
  const latest = useLatest(hooks)
  const mark = (id: string, next: PhotoStatus) => setStatus(before => ({ ...before, [id]: next }))

  // 사진 한 장. 계속해도 되면 true다.
  async function attachOne(id: string) {
    mark(id, { state: 'attaching' })
    const result = await sendChatEvidence(councilId, expenseId, { photoId: id, type: 'receipt' })
    if (!isActive()) return false
    if (result.ok) {
      mark(id, { state: 'done' })
      latest.current.onAttached(result.data)
      return true
    }
    if (reportExpenseLost(latest.current.handlers, result.status)) return false
    mark(id, { state: 'failed', problem: chatEvidenceProblem(result.code) })
    if (isStale(result.code)) latest.current.onStale()
    return false
  }

  async function attachAll() {
    if (busy.current) return
    busy.current = true
    setAttaching(true)
    for (const id of photoIds) {
      if (status[id]?.state === 'done') continue
      if (!(await attachOne(id))) break
    }
    busy.current = false
    if (isActive()) setAttaching(false)
  }

  const left = photoIds.filter(id => status[id]?.state !== 'done').length
  // 붙이는 칸이 사라져도(취소, 사진 한도) 거절 이유는 남긴다.
  const failure = photoIds.map(id => status[id]).find(item => item?.state === 'failed')
  const problem = failure?.state === 'failed' ? failure.problem : null
  return { photoIds, status, left, attaching, problem, attachAll }
}
