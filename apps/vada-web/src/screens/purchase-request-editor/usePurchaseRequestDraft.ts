import { useState } from 'react'
import {
  evaluateButtonExecution,
  getRequiredFieldCandidates,
  hasFieldValue,
} from '../../../../../packages/contracts/src/button-execution.mjs'
import { readObjectSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { getOptionSource } from '../../option-sources/definitions'
import { itemKey, joinRowIds, rowIdsOf } from '../../spec/compute'
import { nextDraftRowId } from '../../spec/draft-rows'
import { resolveParams } from '../../spec/params'
import { finReq01 } from '../../spec/screens'
import type { ButtonSpec, InputSpec, SelectSpec, SubmitAction } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { purchaseRequestSpecs } from './spec'

interface PurchaseRequestDraftOptions {
  screenParams: Record<string, string>
  scopeDraft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

function draftFromRow(row: DataRow): ScopeDraft {
  const values: Record<string, string | null> = {}
  const rowIds: string[] = []
  for (const [key, value] of Object.entries(row)) {
    if (!Array.isArray(value)) {
      values[key] = String(value)
      continue
    }
    value.forEach((item, index) => {
      const rowId = `r${index}`
      rowIds.push(rowId)
      for (const [field, fieldValue] of Object.entries(item)) {
        values[itemKey(key, rowId, field)] = String(fieldValue)
      }
    })
    values[key] = joinRowIds(rowIds)
  }
  return { values, labels: {} }
}

/** 구매 요청의 서버 시드, 반복 품목, 검증, 저장과 제출 상태를 관리한다. */
export function usePurchaseRequestDraft({
  screenParams,
  scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: PurchaseRequestDraftOptions) {
  const specs = purchaseRequestSpecs()
  const [seed] = useState<ScopeDraft>(() =>
    draftFromRow(
      readObjectSource(
        finReq01.draftFrom!.dataSourceKey,
        resolveParams(finReq01.draftFrom!.params, { screenParams }),
      ),
    ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const setDraft = (update: (previous: ScopeDraft) => ScopeDraft) => onChangeDraft(update(draft))
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()
  const rowIds = rowIdsOf(draft, specs.list.fieldKey)
  const itemFields = specs.list.itemFields ?? []

  function setValue(key: string, value: string, label?: string) {
    setDraft((previous) => ({
      values: { ...previous.values, [key]: value },
      labels: label === undefined ? previous.labels : { ...previous.labels, [key]: label },
    }))
  }

  function addItem() {
    const rowId = nextDraftRowId(rowIds)
    setDraft((previous) => {
      const values = { ...previous.values }
      for (const field of itemFields) {
        const spec = field.spec
        if (spec.type === 'input' || spec.type === 'select') {
          values[itemKey(specs.list.fieldKey, rowId, spec.fieldKey)] = spec.initialValue ?? ''
        }
      }
      values[specs.list.fieldKey] = joinRowIds([...rowIds, rowId])
      return { values, labels: previous.labels }
    })
  }

  async function submit(button: ButtonSpec) {
    const action = button.action as SubmitAction
    const fromScreen = screenParams.requestId ?? ''
    const requestId = fromScreen !== '' ? fromScreen : (draft.values.requestId ?? '')
    const result = await submitAction.run(action, {
      payload: { ...draft.values, eventId: screenParams.eventId ?? '', requestId },
      onNavigate,
      paramSources: { screenParams },
      onScopeEvent,
    })
    if (
      result !== undefined &&
      action.onSuccess.scopeEvent === undefined &&
      requestId === '' &&
      typeof result.id === 'string'
    ) {
      setValue('requestId', result.id)
    }
  }

  const isFilled = (candidate: { fieldKey: string; inList: string | null }) => {
    if (candidate.inList === null) return hasFieldValue(draft.values[candidate.fieldKey])
    const listKey = candidate.inList
    return rowIds.every((rowId) =>
      hasFieldValue(draft.values[itemKey(listKey, rowId, candidate.fieldKey)]),
    )
  }
  const labelOfField = (fieldKey: string) =>
    getRequiredFieldCandidates(finReq01.elements).find(
      (candidate) => candidate.fieldKey === fieldKey,
    )?.label ?? fieldKey

  function pressButton(button: ButtonSpec) {
    if (button.action.type === 'pending') {
      setNote(button.action.note)
      return
    }
    const verdict = evaluateButtonExecution({
      action: button.action,
      elements: finReq01.elements,
      values: draft.values,
      isFilled,
    })
    if (!verdict.allowed) {
      setBlockedKeys(verdict.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    void submit(button)
  }

  function reflected(fieldKey: string): string {
    const value = draft.values[fieldKey] ?? ''
    const label = draft.labels[fieldKey]
    if (label !== undefined) return label
    const element = finReq01.elements.find(
      (one) => one.spec.type === 'select' && one.spec.fieldKey === fieldKey,
    )
    if (element?.spec.type === 'select') {
      const source = getOptionSource(element.spec.optionsSource.key)
      if (source.type === 'static') {
        return source.options.find((option) => option.value === value)?.label ?? value
      }
    }
    return value
  }

  const itemField = (fieldKey: string) =>
    itemFields.find(
      (entry) =>
        (entry.spec.type === 'input' || entry.spec.type === 'select') &&
        entry.spec.fieldKey === fieldKey,
    )!.spec as InputSpec | SelectSpec

  return {
    screenParams,
    draft,
    specs,
    rowIds,
    itemFields,
    note,
    blockedKeys,
    submitAction,
    setValue,
    addItem,
    pressButton,
    reflected,
    labelOfField,
    itemField,
  }
}

export type PurchaseRequestDraftModel = ReturnType<typeof usePurchaseRequestDraft>
