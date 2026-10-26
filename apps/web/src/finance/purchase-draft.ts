import { pageState, savePageState } from '@/lib/app-location'
import type { Choice } from '@/tasks/task-form-options'
import type { RequestStart, RequestValues } from './request-form'

export type PurchaseDraft = {
  kind: 'purchase'
  councilId: string
  memberId: string
  eventId?: string | null
  taskId?: string
  pickTask?: boolean
  start?: RequestStart
  // 사람이 고른 값과 자동 조회 표시값은 현재 작성 history 칸에만 남긴다.
  values?: RequestValues
  picked?: Choice | null
}

export function purchaseDraftOf(councilId: string, memberId: string): PurchaseDraft | null {
  const value = pageState()
  if (!value || typeof value !== 'object') return null
  const draft = value as PurchaseDraft
  return draft.kind === 'purchase' && draft.councilId === councilId && draft.memberId === memberId
    ? draft
    : null
}

export function savePurchaseDraft(
  draft: PurchaseDraft,
  values: RequestValues,
  picked: Choice | null,
) {
  savePageState({ ...draft, values, picked })
}
