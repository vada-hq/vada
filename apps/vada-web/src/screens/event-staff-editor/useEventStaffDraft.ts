import { useState } from 'react'
import { evaluateButtonExecution } from '../../../../../packages/contracts/src/button-execution.mjs'
import { readListSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { evt03b } from '../../spec/screen-specs/evt03b'
import type { ButtonSpec, SubmitAction } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { HQ, POOL, SEPARATOR, eventStaffSpecs, rowsOf, scalar } from './spec'

interface EventStaffDraftOptions {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 서버 조직을 초안으로 시드하고 사람 이동·저장·취소 규칙을 관리한다. */
export function useEventStaffDraft({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: EventStaffDraftOptions) {
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()
  const specs = eventStaffSpecs()
  const { leaderCard, departments, panelList } = specs

  const listKey = departments.fieldKey
  if (listKey === undefined) {
    throw new Error('EVT-03B의 부서 목록에 fieldKey가 없습니다. 고친 값을 담을 이름이 없습니다.')
  }

  const leaderRows = readListSource(
    leaderCard.dataSourceKey,
    resolveParams(leaderCard.params, { screenParams }),
  )
  const departmentRows = readListSource(
    departments.dataSourceKey,
    resolveParams(departments.params, { screenParams }),
  )
  const pooledRows = readListSource(
    panelList.dataSourceKey,
    resolveParams(panelList.params, { screenParams }),
  )

  const people = new Map<string, DataRow>()
  for (const row of [...leaderRows, ...pooledRows]) people.set(scalar(row, 'id'), row)
  for (const row of departmentRows) {
    for (const person of rowsOf(row, 'members')) people.set(scalar(person, 'id'), person)
  }

  const memberKey = (departmentId: string) => `${listKey}.${departmentId}.members`
  const fieldKeyOf = (departmentId: string, fieldKey: string) =>
    `${listKey}.${departmentId}.${fieldKey}`
  const seeded: Record<string, string | null> = {
    [HQ]: leaderRows.map((row) => scalar(row, 'id')).join(SEPARATOR),
    [POOL]: pooledRows.map((row) => scalar(row, 'id')).join(SEPARATOR),
  }
  for (const row of departmentRows) {
    seeded[memberKey(scalar(row, 'id'))] = rowsOf(row, 'members')
      .map((person) => scalar(person, 'id'))
      .join(SEPARATOR)
  }
  const values: Record<string, string | null> =
    draft.values[HQ] === undefined ? { ...seeded, ...draft.values } : draft.values

  const idsAt = (holder: string): string[] => {
    const raw = values[holder] ?? ''
    return raw === '' ? [] : raw.split(SEPARATOR)
  }

  function write(next: Record<string, string | null>, labels?: Record<string, string>) {
    onChangeDraft({
      values: { ...values, ...next },
      labels: labels === undefined ? draft.labels : { ...draft.labels, ...labels },
    })
  }

  function move(personId: string, to: string) {
    const holders = [HQ, POOL, ...departmentRows.map((row) => memberKey(scalar(row, 'id')))]
    const next: Record<string, string | null> = {}
    for (const holder of holders) {
      const kept = idsAt(holder).filter((id) => id !== personId)
      next[holder] = (holder === to ? [...kept, personId] : kept).join(SEPARATOR)
    }
    write(next)
  }

  function pressDone() {
    if (specs.done.action.type !== 'submit') return
    const result = evaluateButtonExecution({
      action: specs.done.action,
      elements: evt03b.elements,
      values,
    })
    if (!result.allowed) {
      setBlockedKeys(result.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    void submitAction.run(specs.done.action as SubmitAction, {
      payload: values,
      onNavigate,
      paramSources: { screenParams },
      onScopeEvent,
    })
  }

  const pressAction = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
      return
    }
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
    }
  }

  function pressCancel() {
    if (specs.cancel.action.type !== 'navigate') return
    if (specs.cancel.action.scopeEvent !== undefined) {
      onScopeEvent(evt03b.stateScopeKey ?? '', specs.cancel.action.scopeEvent)
    }
    onNavigate(
      specs.cancel.action.targetScreenId,
      resolveParams(specs.cancel.action.params, { screenParams }),
    )
  }

  return {
    screenParams,
    draft,
    specs,
    note,
    setNote,
    blockedKeys,
    submitAction,
    departmentRows,
    people,
    values,
    memberKey,
    fieldKeyOf,
    idsAt,
    write,
    move,
    pressDone,
    pressAction,
    pressCancel,
  }
}

export type EventStaffDraftModel = ReturnType<typeof useEventStaffDraft>
