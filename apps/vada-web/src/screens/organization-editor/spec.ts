import type { DataRow } from '../../data-sources/definitions'
import { elementByNodeId } from '../../spec/screens'
import { org03b } from '../../spec/screen-specs/org03b'
import type { ButtonSpec, InputSpec, ItemListSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'ORG-03B'
export const SEPARATOR = '\n'
export const HQ = 'executives'
export const POOL = 'unassigned'
export const leaderKey = (departmentId: string) => `${departmentId}.leaders`
export const memberKey = (departmentId: string) => `${departmentId}.members`

export const NODE = {
  breadcrumb: '30:4758', invite: '30:4769', done: '30:4776', executives: '30:4781',
  editExecutives: '30:4788', addExecutive: '30:4842', departments: '30:4848',
  addDepartment: '30:5079', panelHead: '30:5088', search: '30:5095', panelList: '30:5101',
} as const
export const NODE_FIRST = {
  executiveCard: '30:4792', departmentHead: '30:4852', leaderSection: '30:4861',
  leaderCard: '30:4865', memberSection: '30:4886', memberCard: '30:4891', panelCard: '30:5104',
} as const
export const ASSET = {
  breadcrumbSeparator: '30:4762', inviteIcon: '30:4770', executiveIcon: '30:4784',
  addExecutiveIcon: '30:4843', searchIcon: '30:5096', deleteIcon: '30:5124',
  departmentMenu: '30:4855', addDepartmentIcon: '30:5082',
} as const
export const CARD_ART = {
  executive: { avatar: '30:4798', grip: '30:4810', release: '30:4793' },
  viceExecutive: { avatar: '30:4823', grip: '30:4835', release: '30:4818' },
  leader: { avatar: '30:4866', grip: '30:4876', release: '30:4883' },
  member: { avatar: '30:4892', grip: '30:4902', release: '30:4909' },
  pooled: { avatar: '30:5105', grip: '30:5115', release: null },
} as const

export function organizationEditorSpecs() {
  return {
    invite: elementByNodeId(org03b, NODE.invite).spec as ButtonSpec,
    done: elementByNodeId(org03b, NODE.done).spec as ButtonSpec,
    executives: elementByNodeId(org03b, NODE.executives).spec as ItemListSpec,
    editExecutives: elementByNodeId(org03b, NODE.editExecutives).spec as ButtonSpec,
    addExecutive: elementByNodeId(org03b, NODE.addExecutive).spec as ButtonSpec,
    departments: elementByNodeId(org03b, NODE.departments).spec as ItemListSpec,
    addDepartment: elementByNodeId(org03b, NODE.addDepartment).spec as ButtonSpec,
    panelHead: elementByNodeId(org03b, NODE.panelHead).spec as SummarySpec,
    search: elementByNodeId(org03b, NODE.search).spec as InputSpec,
    panelList: elementByNodeId(org03b, NODE.panelList).spec as ItemListSpec,
  }
}

export function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) throw new Error(`ORG-03B의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  return String(value)
}
export function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) throw new Error(`ORG-03B의 조각 '${field}'는 항목 목록이어야 합니다.`)
  return value
}
