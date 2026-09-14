import { useEffect, useState } from 'react'
import {
  evaluateButtonExecution,
  getRequiredFieldCandidates,
  hasFieldValue,
} from '../../../../../packages/contracts/src/button-execution.mjs'
import { readObjectSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { fetchOptions } from '../../option-sources/catalog'
import type { Option } from '../../option-sources/definitions'
import { itemKey, joinRowIds, rowIdsOf } from '../../spec/compute'
import { nextDraftRowId } from '../../spec/draft-rows'
import { draftFromRow } from '../../spec/draft-values'
import { resolveParams } from '../../spec/params'
import { finPlan01 } from '../../spec/screens'
import type { ButtonSpec, ListSpec, NavigateAction, SelectSpec, SubmitAction } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { EVENT_OF_ROW, budgetPlanSpecs, itemFieldOf } from './spec'

interface BudgetPlanDraftOptions {
  scopeDraft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

function seededDraft(row: DataRow, eventListKey: string, eventFieldKey: string): ScopeDraft {
  const { values, labels } = draftFromRow(row)
  const firstEventRow = rowIdsOf({ values, labels }, eventListKey)[0]
  const firstEvent =
    firstEventRow === undefined
      ? null
      : values[itemKey(eventListKey, firstEventRow, EVENT_OF_ROW)]
  if (firstEvent !== null && firstEvent !== undefined && firstEvent !== '') {
    values[eventFieldKey] = firstEvent
    const said = labels[itemKey(eventListKey, firstEventRow, EVENT_OF_ROW)]
    if (said !== undefined) labels[eventFieldKey] = said
  }
  return { values, labels }
}

/** 편성 초안, 반복 줄, 선택지 이름, 검증과 저장 동작을 관리한다. */
export function useBudgetPlanDraft({
  scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: BudgetPlanDraftOptions) {
  const specs = budgetPlanSpecs()
  const departmentSpec = itemFieldOf(specs.items, 'itemDepartment') as SelectSpec
  const eventDepartmentSpec = itemFieldOf(
    specs.eventItems,
    'eventItemDepartment',
  ) as SelectSpec
  const [seed] = useState<ScopeDraft>(() =>
    seededDraft(
      readObjectSource(
        finPlan01.draftFrom!.dataSourceKey,
        resolveParams(finPlan01.draftFrom!.params, {}),
      ),
      specs.eventItems.fieldKey,
      specs.event.fieldKey,
    ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const setDraft = (update: (previous: ScopeDraft) => ScopeDraft) => onChangeDraft(update(draft))
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()
  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([])
  const [eventOptions, setEventOptions] = useState<Option[]>([])
  const departmentSourceKey = departmentSpec.optionsSource.key
  const eventSourceKey = specs.event.optionsSource.key

  useEffect(() => {
    let alive = true
    const bring = (key: string, keep: (options: Option[]) => void) => {
      fetchOptions(key, {})
        .then((options) => {
          if (alive) keep(options)
        })
        .catch(() => {})
    }
    bring(departmentSourceKey, setDepartmentOptions)
    bring(eventSourceKey, setEventOptions)
    return () => {
      alive = false
    }
  }, [departmentSourceKey, eventSourceKey])

  const labelOf = (options: Option[], key: string, value: string) =>
    options.find((option) => option.value === value)?.label ?? draft.labels[key] ?? value
  const sourceRowIds = rowIdsOf(draft, specs.sources.fieldKey)
  const itemRowIds = rowIdsOf(draft, specs.items.fieldKey)
  const eventRowIds = rowIdsOf(draft, specs.eventItems.fieldKey)
  const chosenEvent = draft.values[specs.event.fieldKey] ?? ''
  const shownEventRowIds = eventRowIds.filter(
    (rowId) =>
      (draft.values[itemKey(specs.eventItems.fieldKey, rowId, EVENT_OF_ROW)] ?? '') ===
      chosenEvent,
  )

  function setValue(key: string, value: string, label?: string) {
    setDraft((previous) => ({
      values: { ...previous.values, [key]: value },
      labels: label === undefined ? previous.labels : { ...previous.labels, [key]: label },
    }))
  }

  function addRow(list: ListSpec, rowIds: string[], extra: Record<string, string> = {}) {
    const rowId = nextDraftRowId(rowIds)
    setDraft((previous) => {
      const values = { ...previous.values }
      for (const field of list.itemFields ?? []) {
        const spec = field.spec
        if (spec.type === 'input' || spec.type === 'select') {
          values[itemKey(list.fieldKey, rowId, spec.fieldKey)] = spec.initialValue ?? ''
        }
      }
      for (const [field, value] of Object.entries(extra)) {
        values[itemKey(list.fieldKey, rowId, field)] = value
      }
      values[list.fieldKey] = joinRowIds([...rowIds, rowId])
      return { values, labels: previous.labels }
    })
  }

  function removeRow(list: ListSpec, rowIds: string[], rowId: string) {
    setDraft((previous) => {
      const values = { ...previous.values }
      for (const key of Object.keys(values)) {
        if (key.startsWith(`${list.fieldKey}.${rowId}.`)) delete values[key]
      }
      values[list.fieldKey] = joinRowIds(rowIds.filter((id) => id !== rowId))
      return { values, labels: previous.labels }
    })
  }

  const rowIdsByList: Record<string, string[]> = {
    [specs.sources.fieldKey]: sourceRowIds,
    [specs.items.fieldKey]: itemRowIds,
    [specs.eventItems.fieldKey]: eventRowIds,
  }
  const isFilled = (candidate: { fieldKey: string; inList: string | null }) => {
    if (candidate.inList === null) return hasFieldValue(draft.values[candidate.fieldKey])
    const listKey = candidate.inList
    return (rowIdsByList[listKey] ?? []).every((rowId) =>
      hasFieldValue(draft.values[itemKey(listKey, rowId, candidate.fieldKey)]),
    )
  }
  const labelOfField = (fieldKey: string) =>
    getRequiredFieldCandidates(finPlan01.elements).find(
      (candidate) => candidate.fieldKey === fieldKey,
    )?.label ?? fieldKey

  function pressButton(button: ButtonSpec) {
    const action = button.action
    if (action.type !== 'navigate' && action.type !== 'submit') {
      setNote('note' in action && typeof action.note === 'string' ? action.note : null)
      return
    }
    const verdict = evaluateButtonExecution({
      action,
      elements: finPlan01.elements,
      values: draft.values,
      isFilled,
    })
    if (!verdict.allowed) {
      setBlockedKeys(verdict.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    setNote(null)
    if (action.type === 'navigate') {
      const navigate = action as NavigateAction
      if (navigate.scopeEvent !== undefined) {
        onScopeEvent(finPlan01.stateScopeKey ?? '', navigate.scopeEvent)
      }
      onNavigate(navigate.targetScreenId, resolveParams(navigate.params, {}))
      return
    }
    void submitAction.run(action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      onScopeEvent,
    })
  }

  return {
    specs,
    draft,
    note,
    blockedKeys,
    submitAction,
    departmentSpec,
    eventDepartmentSpec,
    departmentOptions,
    eventOptions,
    sourceRowIds,
    itemRowIds,
    eventRowIds,
    chosenEvent,
    shownEventRowIds,
    labelOf,
    setValue,
    addRow,
    removeRow,
    pressButton,
    labelOfField,
  }
}

export type BudgetPlanDraftModel = ReturnType<typeof useBudgetPlanDraft>
