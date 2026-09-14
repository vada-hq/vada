import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { drawnTitleOf, elementByNodeId, org03c } from '../../spec/screens'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ButtonSpec, ItemListSpec, SubmitAction, SummarySpec } from '../../spec/types'
import { NODE } from './spec'

export interface OrganizationInviteProps {
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function inviteScalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`ORG-03C의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function useOrganizationInvite({ onNavigate }: OrganizationInviteProps) {
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()
  const back = elementByNodeId(org03c, NODE.back).spec as ButtonSpec
  const close = elementByNodeId(org03c, NODE.close).spec as ButtonSpec
  const executives = elementByNodeId(org03c, NODE.executives).spec as ItemListSpec
  const addExecutive = elementByNodeId(org03c, NODE.addExecutive).spec as ButtonSpec
  const departments = elementByNodeId(org03c, NODE.departments).spec as ItemListSpec
  const intro = elementByNodeId(org03c, NODE.intro).spec as SummarySpec
  const state = elementByNodeId(org03c, NODE.state).spec as SummarySpec
  const link = elementByNodeId(org03c, NODE.link).spec as SummarySpec
  const code = elementByNodeId(org03c, NODE.code).spec as SummarySpec
  const executiveRows = readListSource(executives.dataSourceKey)
  const departmentRows = readListSource(departments.dataSourceKey)
  const invite = readObjectSource(state.dataSourceKey)
  const chart = readObjectSource(intro.dataSourceKey)

  function press(spec: ButtonSpec) {
    const action = spec.action
    if (action.type === 'navigate') {
      onNavigate(action.targetScreenId)
      return
    }
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    if (action.type === 'submit') {
      void submitAction.run(action as SubmitAction, { payload: {}, onNavigate })
      return
    }
    if (action.type === 'copy') {
      const value = inviteScalar(readObjectSource(action.copySourceKey), action.copyField)
      void navigator.clipboard?.writeText(value)
      setNote(`${spec.label}: ${value}`)
    }
  }

  const actionAt = (nodeId: string) => elementByNodeId(org03c, nodeId).spec as ButtonSpec

  return {
    screen: org03c,
    title: drawnTitleOf(org03c),
    onNavigate,
    note,
    submitAction,
    press,
    back,
    close,
    executives,
    addExecutive,
    departments,
    intro,
    state,
    link,
    code,
    executiveRows,
    departmentRows,
    invite,
    chart,
    executiveCard: executives.itemFields![0].spec as SummarySpec,
    departmentCard: departments.itemFields![0].spec as SummarySpec,
    copyLink: actionAt(NODE.copyLink),
    regenerateLink: actionAt(NODE.regenerateLink),
    copyCode: actionAt(NODE.copyCode),
    regenerateCode: actionAt(NODE.regenerateCode),
    regenerateAll: actionAt(NODE.regenerateAll),
  }
}

export type OrganizationInviteModel = ReturnType<typeof useOrganizationInvite>
