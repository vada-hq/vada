import { useState } from 'react'
import type { DragEvent } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { targetScreenOf, type ButtonSpec, type SubmitAction } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import {
  HQ, POOL, SEPARATOR, leaderKey, memberKey, organizationEditorSpecs, rowsOf, scalar,
} from './spec'

interface OrganizationDraftOptions {
  scopeDraft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 조직 초안의 사람 배치, 드래그 이동, 검색과 저장 동작을 관리한다. */
export function useOrganizationDraft({
  scopeDraft, onChangeDraft, onScopeEvent, onNavigate,
}: OrganizationDraftOptions) {
  const [note, setNote] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const submitAction = useSubmitAction()
  const specs = organizationEditorSpecs()
  const executiveRows = readListSource(specs.executives.dataSourceKey)
  const departmentRows = readListSource(specs.departments.dataSourceKey)
  const pooledRows = readListSource(specs.panelList.dataSourceKey)
  const hint = readObjectSource(specs.panelHead.dataSourceKey)

  const people = new Map<string, DataRow>()
  const remember = (row: DataRow) => {
    const id = scalar(row, 'id')
    people.set(id, { ...people.get(id), ...row })
  }
  for (const row of executiveRows) remember(row)
  for (const row of departmentRows) {
    for (const person of [...rowsOf(row, 'leaders'), ...rowsOf(row, 'members')]) remember(person)
  }
  for (const row of pooledRows) remember(row)

  const seeded: Record<string, string> = {
    [HQ]: executiveRows.map((row) => scalar(row, 'id')).join(SEPARATOR),
    [POOL]: pooledRows.map((row) => scalar(row, 'id')).join(SEPARATOR),
  }
  for (const row of departmentRows) {
    const id = scalar(row, 'id')
    seeded[leaderKey(id)] = rowsOf(row, 'leaders').map((person) => scalar(person, 'id')).join(SEPARATOR)
    seeded[memberKey(id)] = rowsOf(row, 'members').map((person) => scalar(person, 'id')).join(SEPARATOR)
  }
  const values = scopeDraft.values[HQ] !== undefined ? scopeDraft.values : seeded
  const query = scopeDraft.values[specs.search.fieldKey] ?? ''
  const idsAt = (holder: string): string[] => {
    const raw = values[holder] ?? ''
    return raw === '' ? [] : raw.split(SEPARATOR)
  }

  function writeHolders(next: Record<string, string>) {
    onChangeDraft({
      values: { ...values, ...next, [specs.search.fieldKey]: query },
      labels: scopeDraft.labels,
    })
  }
  function move(memberId: string, to: string) {
    const next: Record<string, string> = {}
    for (const holder of Object.keys(values)) {
      if (holder === specs.search.fieldKey) continue
      const kept = idsAt(holder).filter((id) => id !== memberId)
      next[holder] = kept.join(SEPARATOR)
    }
    next[to] = [...(next[to] === '' ? [] : next[to].split(SEPARATOR)), memberId].join(SEPARATOR)
    writeHolders(next)
    setDragging(null)
  }
  function removeMember(memberId: string) {
    const action = specs.panelList.itemRemove?.action
    if (action?.type !== 'navigate') return
    const row = people.get(memberId) ?? {}
    const target = targetScreenOf(action, row)
    if (target !== null) onNavigate(target, resolveParams(action.params, { row }))
  }
  function setQuery(next: string) {
    onChangeDraft({ values: { ...values, [specs.search.fieldKey]: next }, labels: scopeDraft.labels })
  }
  const pooledIds = idsAt(POOL).filter((id) => {
    const person = people.get(id)
    return person !== undefined && (query.trim() === '' || scalar(person, 'name').includes(query.trim()))
  })
  const pressAction = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') setNote(spec.action.note)
    if (spec.action.type === 'navigate') {
      const target = targetScreenOf(spec.action, {})
      if (target !== null) onNavigate(target)
    }
  }
  function pressDone() {
    void submitAction.run(specs.done.action as SubmitAction, {
      payload: values, onNavigate, onScopeEvent,
    })
  }
  const dropTarget = (holder: string) => ({
    onDragOver: (event: DragEvent) => {
      if (dragging !== null) event.preventDefault()
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      const memberId = event.dataTransfer.getData('text/plain') || dragging
      if (memberId !== null && memberId !== '') move(memberId, holder)
    },
  })
  const personOf = (id: string) => {
    const person = people.get(id)
    if (person === undefined) throw new Error(`ORG-03B의 구성원 '${id}'를 찾을 수 없습니다.`)
    return person
  }

  return {
    specs, note, setNote, setDragging, submitAction, departmentRows, hint, values, query,
    pooledIds, idsAt, move, removeMember, setQuery, pressAction, pressDone, dropTarget, personOf,
  }
}

export type OrganizationDraftModel = ReturnType<typeof useOrganizationDraft>
