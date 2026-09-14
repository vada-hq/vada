import { useState } from 'react'
import { readListSource } from '../../data-sources/catalog'
import { drawnTitleOf, elementByNodeId, org03a } from '../../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../../spec/types'
import { NODE } from './spec'

export interface OrganizationChartProps {
  onNavigate: (screenId: string) => void
}

export function useOrganizationChart({ onNavigate }: OrganizationChartProps) {
  const [note, setNote] = useState<string | null>(null)
  const executives = elementByNodeId(org03a, NODE.executives).spec as ItemListSpec
  const addMember = elementByNodeId(org03a, NODE.addMember).spec as ButtonSpec
  const departments = elementByNodeId(org03a, NODE.departments).spec as ItemListSpec
  const [nameSpec, leaderList, memberList] = departments.itemFields!.map((entry) => entry.spec)

  return {
    screen: org03a,
    title: drawnTitleOf(org03a),
    onNavigate,
    note,
    setNote,
    breadcrumb: org03a.breadcrumb,
    executives,
    executiveRows: readListSource(executives.dataSourceKey),
    executiveCard: executives.itemFields![0].spec as SummarySpec,
    addMember,
    departments,
    departmentRows: readListSource(departments.dataSourceKey),
    nameSpec: nameSpec as SummarySpec,
    leaderList: leaderList as ItemListSpec,
    memberList: memberList as ItemListSpec,
  }
}

export type OrganizationChartModel = ReturnType<typeof useOrganizationChart>
