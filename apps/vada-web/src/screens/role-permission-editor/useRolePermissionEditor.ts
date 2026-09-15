import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { getOptionSource } from '../../option-sources/definitions'
import { initialChosen } from '../../spec/chosen'
import { elementByNodeId } from '../../spec/screens'
import { org04b } from '../../spec/screen-specs/org04b'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type {
  ButtonSpec,
  ItemListSpec,
  SelectSpec,
  SubmitAction,
  SummarySpec,
} from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { NODE } from './spec'

export interface RolePermissionEditorProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function roleScalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`ORG-04B의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function useRolePermissionEditor({
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: RolePermissionEditorProps) {
  const scopeBadge = elementByNodeId(org04b, NODE.scopeBadge).spec as SummarySpec
  const banner = elementByNodeId(org04b, NODE.banner).spec as SummarySpec
  const members = elementByNodeId(org04b, NODE.members).spec as ItemListSpec
  const memberCount = elementByNodeId(org04b, NODE.memberCount).spec as SummarySpec
  const selected = elementByNodeId(org04b, NODE.selected).spec as SummarySpec
  const roleChoice = elementByNodeId(org04b, NODE.roleChoice).spec as SelectSpec
  const revert = elementByNodeId(org04b, NODE.revert).spec as ButtonSpec
  const apply = elementByNodeId(org04b, NODE.apply).spec as ButtonSpec
  const rows = readListSource(members.dataSourceKey)
  const counts = readObjectSource(memberCount.dataSourceKey)
  const choose = members.itemAction
  if (choose?.type !== 'choose') {
    throw new Error("ORG-04B의 목록이 'choose'가 아닙니다. 고른 사람을 담을 자리가 없습니다.")
  }
  const chooseFieldKey = choose.fieldKey
  const chooseItemField = choose.itemField
  const [chosenId, setChosenId] = useState<string>(() => initialChosen(org04b)[chooseFieldKey] ?? '')
  const person = readObjectSource(selected.dataSourceKey, {
    [Object.keys(selected.params!)[0]!]: chosenId,
  })
  const source = getOptionSource(roleChoice.optionsSource.key)
  const options = source.type === 'static' ? source.options : []
  const roleChoiceKey = roleChoice.fieldKey
  const role = draft.values[roleChoiceKey] ?? roleScalar(person, 'role')
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()

  const setRole = (next: string) =>
    onChangeDraft({
      ...draft,
      values: { ...draft.values, [roleChoiceKey]: next },
      labels: {
        ...draft.labels,
        [roleChoiceKey]: options.find((option) => option.value === next)?.label ?? next,
      },
    })

  function chooseMember(row: DataRow) {
    const next = roleScalar(row, chooseItemField)
    setChosenId(next)
    setRole(roleScalar(row, 'role'))
    setNote(null)
  }

  function pressApply() {
    void submitAction.run(apply.action as SubmitAction, {
      payload: { [roleChoice.fieldKey]: role },
      params: { memberId: chosenId },
      onNavigate,
      onScopeEvent,
    })
  }

  function pressRevert() {
    if (revert.action.type === 'navigate') onNavigate(revert.action.targetScreenId)
  }

  return {
    screen: org04b,
    onNavigate,
    scopeBadge,
    banner,
    members,
    memberCount,
    selected,
    roleChoice,
    revert,
    apply,
    rows,
    counts,
    choose,
    person,
    memberCard: members.itemFields![0].spec as SummarySpec,
    options,
    role,
    note,
    submitAction,
    setRole,
    chooseMember,
    pressApply,
    pressRevert,
  }
}

export type RolePermissionEditorModel = ReturnType<typeof useRolePermissionEditor>
