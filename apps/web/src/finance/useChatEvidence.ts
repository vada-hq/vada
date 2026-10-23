import { useRef, useState } from 'react'
import {
  AttachChatEvidenceSchema,
  type ChatPhotoListResponse,
  type EvidenceType,
  type ExpenseResponse,
} from '@vada/contracts'
import { postJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { usePolledRead } from '@/lib/use-polled-read'
import { chatEvidencePath, chatPhotosPath } from './expense-api'
import { chatEvidenceProblem, isStale, reportExpenseLost } from './expense-requests'
import type { EvidenceHooks } from './useEvidenceUpload'

// 대화 사진 한 장을 증빙으로 붙이는 요청(조각 1 경로). 지출 상세의 고르기와 메시지의 사진 붙이기가 함께 쓴다.
export const sendChatEvidence = (
  councilId: string,
  expenseId: string,
  body: { photoId: string; type: EvidenceType },
) => postJson<ExpenseResponse>(chatEvidencePath(councilId, expenseId), body)

type Latest = { current: EvidenceHooks }

// 목록을 열고 사진 한 장과 종류를 고르는 상태. 목록은 열려 있을 때만 읽는다.
function useChoice(councilId: string, latest: Latest) {
  const [open, setOpen] = useState(false)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [type, setType] = useState<EvidenceType>('receipt')
  const list = usePolledRead<ChatPhotoListResponse>(
    chatPhotosPath(councilId),
    status => void reportExpenseLost(latest.current.handlers, status),
    open,
  )
  // 목록을 다시 읽어 사라졌으면 고른 것도 없는 것으로 본다.
  const chosen =
    list.state.kind === 'ready'
      ? (list.state.data.photos.find(photo => photo.id === chosenId) ?? null)
      : null
  const reset = () => {
    setOpen(false)
    setChosenId(null)
    setType('receipt')
  }
  return {
    open,
    show: () => setOpen(true),
    reset,
    list,
    chosen,
    chosenId,
    setChosenId,
    type,
    setType,
  }
}

// 대화에서 사진 한 장 고르기: 목록 열기 → 고르기 → 종류 → 붙이기. 올리지 않고 서버가 저장소 안에서 복사한다.
// 붙이는 중에는 다른 사진을 받지 않는다.
export function useChatEvidence(councilId: string, expenseId: string, hooks: EvidenceHooks) {
  const [problem, setProblem] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const busy = useRef(false)
  const isActive = useActive()
  const latest = useLatest(hooks)
  // 안의 일(되돌리기, 번호)은 화면에 내주지 않는다.
  const { reset, chosenId, setChosenId, list, ...view } = useChoice(councilId, latest)

  // 붙이는 중에는 화면이 버튼을 막아 두므로 여기서는 막지 않는다.
  const close = () => {
    reset()
    setProblem(null)
  }
  const choose = (id: string | null) => {
    setChosenId(id)
    setProblem(null)
  }

  async function attach() {
    const body = AttachChatEvidenceSchema.safeParse({ photoId: chosenId, type: view.type })
    if (!body.success || busy.current) return
    busy.current = true
    setAttaching(true)
    setProblem(null)
    const result = await sendChatEvidence(councilId, expenseId, body.data)
    busy.current = false
    if (!isActive()) return
    setAttaching(false)
    if (result.ok) {
      close()
      return latest.current.onAttached(result.data)
    }
    if (reportExpenseLost(latest.current.handlers, result.status)) return
    setProblem(chatEvidenceProblem(result.code))
    if (result.code === 'MESSAGE_INVALID') {
      setChosenId(null)
      void list.reload()
    } else if (isStale(result.code)) latest.current.onStale()
  }

  return {
    ...view,
    list: list.state,
    reload: list.reload,
    close,
    choose,
    problem,
    attaching,
    attach,
  }
}
