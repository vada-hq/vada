import { useState } from 'react'
import { evaluateButtonExecution } from '../../../../../packages/contracts/src/button-execution.mjs'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { evt01 } from '../../spec/screen-specs/evt01'
import type { ButtonSpec, ItemListSpec, SelectSpec, SubmitAction, SummarySpec } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { NODE } from './spec'

interface EventSetupDraftOptions {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 설정 선택, 미리보기 조회, 필수값 판정과 저장을 관리한다. */
export function useEventSetupDraft({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: EventSetupDraftOptions) {
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()
  const missing = (evt01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) return { ready: false as const, missing }

  const head = elementByNodeId(evt01, NODE.head).spec as SummarySpec
  const setupMode = elementByNodeId(evt01, NODE.setupMode).spec as SelectSpec
  const leader = elementByNodeId(evt01, NODE.leader).spec as SelectSpec
  const preview = elementByNodeId(evt01, NODE.preview).spec as ItemListSpec
  const back = elementByNodeId(evt01, NODE.back).spec as ButtonSpec
  const save = elementByNodeId(evt01, NODE.save).spec as ButtonSpec
  const eventRow = readObjectSource(
    head.dataSourceKey,
    resolveParams(head.params, { screenParams }),
  )
  const values: Record<string, string | null> = { ...draft.values }
  for (const spec of [setupMode, leader]) {
    if (values[spec.fieldKey] === undefined) values[spec.fieldKey] = spec.initialValue
  }

  function setValue(spec: SelectSpec, value: string, label: string) {
    onChangeDraft({
      values: { ...values, [spec.fieldKey]: value },
      labels: { ...draft.labels, [spec.fieldKey]: label },
    })
  }

  function optionOf(spec: SelectSpec) {
    const value = values[spec.fieldKey]
    if (typeof value !== 'string' || value === '') return null
    return { value, label: draft.labels[spec.fieldKey] ?? value }
  }

  const previewRows = readListSource(
    preview.dataSourceKey,
    resolveParams(preview.params, { screenParams, fields: values }),
  )
  const [nameSpec, leaderList, memberList] = preview.itemFields!.map((entry) => entry.spec)

  function pressSave() {
    if (save.action.type !== 'submit') return
    const result = evaluateButtonExecution({ action: save.action, elements: evt01.elements, values })
    if (!result.allowed) {
      setBlockedKeys(result.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    void submitAction.run(save.action as SubmitAction, {
      payload: values,
      onNavigate,
      paramSources: { screenParams },
      onScopeEvent,
    })
  }

  function pressBack() {
    if (back.action.type === 'navigate') {
      onNavigate(back.action.targetScreenId, resolveParams(back.action.params, { screenParams }))
    }
  }

  const errorOf = (spec: SelectSpec) =>
    blockedKeys.includes(spec.fieldKey) ? '필수 항목입니다' : undefined

  return {
    ready: true as const,
    screenParams,
    head,
    setupMode,
    leader,
    preview,
    back,
    save,
    eventRow,
    values,
    previewRows,
    nameSpec: nameSpec as SummarySpec,
    leaderList: leaderList as ItemListSpec,
    memberList: memberList as ItemListSpec,
    note,
    setNote,
    blockedKeys,
    submitAction,
    setValue,
    optionOf,
    pressSave,
    pressBack,
    errorOf,
  }
}

export type EventSetupDraftModel = ReturnType<typeof useEventSetupDraft>
export type ReadyEventSetupDraftModel = Extract<EventSetupDraftModel, { ready: true }>
