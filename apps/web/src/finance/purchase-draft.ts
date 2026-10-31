import { pageState, savePageState } from '@/lib/app-location'
import type { CommandMemo } from '@/lib/command-id'
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
  // 앞서 보낸 명령 번호. 응답을 잃고 새로고침한 뒤의 재시도를 같은 요청으로 가른다.
  command?: CommandMemo
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
  command: CommandMemo,
) {
  savePageState({ ...draft, values, picked, command })
}
