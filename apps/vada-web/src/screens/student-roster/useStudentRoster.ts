import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, org07a } from '../../spec/screens'
import type { ButtonSpec, InputSpec, ItemListSpec, SummarySpec } from '../../spec/types'
import { STUDENT_ROSTER_NODE as NODE } from './config'

export interface RosterOption {
  value: string
  label: string
}

export function useStudentRoster(onNavigate: (screenId: string) => void) {
  const scope = elementByNodeId(org07a, NODE.scope).spec as SummarySpec
  const rosterUpdate = elementByNodeId(org07a, NODE.rosterUpdate).spec as SummarySpec
  const duesUpdate = elementByNodeId(org07a, NODE.duesUpdate).spec as SummarySpec
  const search = elementByNodeId(org07a, NODE.search).spec as InputSpec
  const students = elementByNodeId(org07a, NODE.students).spec as ItemListSpec
  const paging = students.paging!

  const [note, setNote] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState<RosterOption | null>(null)
  const [dues, setDues] = useState<RosterOption | null>(null)
  const [page, setPage] = useState(1)

  const fieldValues: Record<string, string> = {
    [search.fieldKey]: query,
    studentGrade: grade?.value ?? '',
    studentDues: dues?.value ?? '',
  }
  const scopeRow = readObjectSource(scope.dataSourceKey)
  const rows = readListSource(students.dataSourceKey, {
    ...resolveParams(students.params, { fields: fieldValues }),
    [paging.pageParam]: String(page),
  })
  const pageInfo = readObjectSource(
    paging.dataSourceKey,
    resolveParams(paging.params, { fields: fieldValues }),
  )
  const pageCount = Number(pageInfo[paging.pageCountField])

  function pressHeaderAction(nodeId: string) {
    const spec = elementByNodeId(org07a, nodeId).spec as ButtonSpec
    if (spec.action.type === 'pending') setNote(spec.action.note)
    if (spec.action.type === 'navigate') onNavigate(spec.action.targetScreenId)
  }

  function changeQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function selectGrade(value: RosterOption) {
    setGrade(value)
    setPage(1)
  }

  function selectDues(value: RosterOption) {
    setDues(value)
    setPage(1)
  }

  return {
    scope,
    rosterUpdate,
    duesUpdate,
    search,
    students,
    paging,
    note,
    query,
    grade,
    dues,
    page,
    scopeRow,
    rows,
    pageInfo,
    pageCount,
    pressHeaderAction,
    changeQuery,
    selectGrade,
    selectDues,
    setPage,
  }
}

export type StudentRosterModel = ReturnType<typeof useStudentRoster>
