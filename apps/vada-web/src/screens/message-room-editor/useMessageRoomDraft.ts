import { useState } from 'react'
import { readListSource } from '../../data-sources/catalog'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { msg02 } from '../../spec/screen-specs/msg02'
import type {
  ButtonSpec,
  InputSpec,
  ItemListSpec,
  SelectSpec,
  SummarySpec,
} from '../../spec/types'
import { useFieldDraft } from '../../spec/useFieldDraft'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { NODE, NODE_FIRST } from './spec'

export interface MessageRoomDraftProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useMessageRoomDraft({
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: MessageRoomDraftProps) {
  const head = elementByNodeId(msg02, NODE.head).spec as SummarySpec
  const close = elementByNodeId(msg02, NODE.close).spec as ButtonSpec
  const category = elementByNodeId(msg02, NODE.category).spec as SelectSpec
  const roomName = elementByNodeId(msg02, NODE.roomName).spec as InputSpec
  const members = elementByNodeId(msg02, NODE.members).spec as SummarySpec
  const targets = elementByNodeId(msg02, NODE.targets).spec as SummarySpec
  const memberQuery = elementByNodeId(msg02, NODE.memberQuery).spec as InputSpec
  const departments = elementByNodeId(msg02, NODE.departments).spec as ItemListSpec
  const cancel = elementByNodeId(msg02, NODE.cancel).spec as ButtonSpec
  const create = elementByNodeId(msg02, NODE.create).spec as ButtonSpec

  const wholeDepartment = (departments.itemFields ?? []).find(
    (field) => field.source?.nodeId === NODE_FIRST.wholeDepartment,
  )?.spec as ButtonSpec
  const expandDepartment = (departments.itemFields ?? []).find(
    (field) => field.source?.nodeId === NODE_FIRST.expandDepartment,
  )?.spec as ButtonSpec

  const field = useFieldDraft({ elements: msg02.elements, draft, onChangeDraft })
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)

  // 목록은 받아온 것을 화면에서 거르지 않는다. 검색어가 바뀌면 다시 조회한다.
  const rows = readListSource(
    departments.dataSourceKey,
    resolveParams(departments.params, { fields: draft.values }),
  )

  // 떠나면서 어디로 가는지도, 초안을 어떻게 끝내는지도 **명세가 말한다.**
  // 여기서 정하면 명세를 고쳐도 화면이 안 따라온다.
  const goBack = (button: ButtonSpec) => {
    if (button.action.type !== 'navigate') return
    if (button.action.scopeEvent !== undefined) {
      onScopeEvent(msg02.stateScopeKey ?? '', button.action.scopeEvent)
    }
    onNavigate(button.action.targetScreenId)
  }

  const runPending = (button: ButtonSpec) => {
    if (button.action.type === 'pending') setNote(button.action.note)
  }

  const roomNameError = field.errors[roomName.fieldKey]


  return {
    head,
    close,
    category,
    roomName,
    members,
    targets,
    memberQuery,
    departments,
    cancel,
    create,
    wholeDepartment,
    expandDepartment,
    field,
    submitAction,
    note,
    rows,
    goBack,
    runPending,
    roomNameError,
    draft,
    onNavigate,
    onScopeEvent,
  }
}

export type MessageRoomDraftModel = ReturnType<typeof useMessageRoomDraft>
