import { useEffect, useRef, useState } from 'react'
import { AttachEvidenceSchema, type EvidenceType, type ExpenseResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import {
  EVIDENCE_UPLOAD_FAILED,
  EXPENSE_ERRORS,
  PHOTO_CANNOT_OPEN,
  PHOTO_TOO_BIG,
} from '@/lib/messages'
import { photoName, sendPhoto, TOO_BIG, UNREADABLE } from '@/lib/photo-upload'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { evidencePath, evidenceUploadsPath } from './expense-api'
import {
  expenseProblem,
  isStale,
  reportExpenseLost,
  type ExpenseDialogHandlers,
} from './expense-requests'

// 붙이기 전 사진 한 장. 고르는 즉시 줄여서 올리고, 올라가면 키를 쥐고 있다가 종류와 함께 붙인다.
type PendingPhoto = {
  name: string
  preview: string | null
  state: 'uploading' | 'ready' | 'failed'
  key?: string
}

export type EvidenceHooks = {
  handlers: Pick<ExpenseDialogHandlers, 'onLost' | 'onForbidden'>
  // 붙이면 돌려받은 지출을 놓는다.
  onAttached: (data: ExpenseResponse) => void
  // 이미 바뀐 상태(취소됨, 사진 한도)면 지출을 다시 읽는다.
  onStale: () => void
}

const uploadProblem = (result: { code: string }) => {
  if (result.code === UNREADABLE) return PHOTO_CANNOT_OPEN
  if (result.code === TOO_BIG) return PHOTO_TOO_BIG
  return EXPENSE_ERRORS[result.code] ?? EVIDENCE_UPLOAD_FAILED
}

// 이 사진은 붙일 수 없다. 빼고 다시 올려야 한다(그 밖의 실패는 같은 사진으로 다시 누를 수 있다).
const UNUSABLE_CODES = ['UPLOAD_MISMATCH', 'PHOTO_ALREADY_SENT']

// 붙일 사진 한 장의 상태와 미리 보기 주소. 치우거나 화면이 사라지면 미리 보기 주소를 거둔다.
function usePendingPhoto() {
  const [photo, setPhoto] = useState<PendingPhoto | null>(null)
  const preview = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (preview.current) URL.revokeObjectURL(preview.current)
    },
    [],
  )
  const patch = (change: Partial<PendingPhoto>) =>
    setPhoto(before => before && { ...before, ...change })
  const showPreview = (url: string) => {
    preview.current = url
    patch({ preview: url })
  }
  const drop = () => {
    if (preview.current) URL.revokeObjectURL(preview.current)
    preview.current = null
    setPhoto(null)
  }
  return { photo, start: setPhoto, patch, showPreview, drop }
}

// 증빙 사진 한 장씩: 고르기 → 줄여 올리기 → 종류 고르기 → 붙이기. 올리는 중이거나 붙이는 중에는 다른 사진을 받지 않는다.
export function useEvidenceUpload(councilId: string, expenseId: string, hooks: EvidenceHooks) {
  const pending = usePendingPhoto()
  const [type, setType] = useState<EvidenceType>('receipt')
  const [problem, setProblem] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const busy = useRef(false)
  const isActive = useActive()
  const latest = useLatest(hooks)

  const clear = () => {
    pending.drop()
    setProblem(null)
    setType('receipt')
  }

  async function pick(file: File) {
    if (busy.current || pending.photo) return
    busy.current = true
    setProblem(null)
    pending.start({ name: photoName(file.name), preview: null, state: 'uploading' })
    const result = await sendPhoto(evidenceUploadsPath(councilId, expenseId), file, url =>
      pending.showPreview(url),
    )
    busy.current = false
    if (!isActive()) return
    if (result.ok) return pending.patch({ state: 'ready', key: result.key })
    if (reportExpenseLost(latest.current.handlers, result.status)) return
    pending.patch({ state: 'failed' })
    setProblem(uploadProblem(result))
  }

  async function attach() {
    const body = AttachEvidenceSchema.safeParse({ key: pending.photo?.key, type })
    if (!body.success || busy.current) return
    busy.current = true
    setAttaching(true)
    setProblem(null)
    const result = await postJson<ExpenseResponse>(evidencePath(councilId, expenseId), body.data)
    busy.current = false
    if (!isActive()) return
    setAttaching(false)
    if (result.ok) {
      clear()
      return latest.current.onAttached(result.data)
    }
    if (reportExpenseLost(latest.current.handlers, result.status)) return
    if (UNUSABLE_CODES.includes(result.code)) pending.patch({ state: 'failed' })
    setProblem(expenseProblem(result.code))
    if (isStale(result.code)) latest.current.onStale()
  }

  return { photo: pending.photo, type, setType, problem, attaching, pick, attach, clear }
}
