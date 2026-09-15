import type { DataRow } from '../../data-sources/definitions'
import { elementByNodeId } from '../../spec/screens'
import { evt03b } from '../../spec/screen-specs/evt03b'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'EVT-03B'
export const SEPARATOR = '\n'
export const HQ = 'leaders'
export const POOL = 'unassigned'

export const NODE = {
  cancel: '20:7061',
  done: '20:7063',
  editBasics: '20:7108',
  startEvent: '20:7110',
  staffTab: '20:7116',
  participantsTab: '20:7119',
  leader: '20:7122',
  newDepartment: '20:7129',
  addDepartment: '20:7135',
  leaderCard: '20:7141',
  changeLeader: '20:7165',
  departments: '20:7171',
  panelHead: '20:7297',
  panelList: '20:7302',
} as const

export const NODE_FIRST = {
  leaderPerson: '20:7149',
  departmentHead: '20:7175',
  departmentLeader: '20:7184',
  memberSection: '20:7192',
  memberCard: '20:7196',
  addMember: '20:7214',
  panelCard: '20:7303',
} as const

export const ASSET = {
  workspaceStatus: { startAt: '20:7098' } as Record<string, string>,
  leaderChevron: '20:7127',
  addDepartmentIcon: '20:7136',
  leaderCardIcon: '20:7143',
  leaderAvatar: '20:7150',
  leaderRelease: '20:7162',
  changeLeaderIcon: '20:7166',
  panelAvatar: '20:7304',
} as const

export const DEPARTMENT_ART = [
  { menu: '20:7178', chevron: '20:7190', release: '20:7202', addChevron: '20:7216' },
  { menu: '20:7225', chevron: '20:7237', release: '20:7249', addChevron: '20:7254' },
  { menu: '20:7263', chevron: '20:7275', release: '20:7288', addChevron: '20:7293' },
] as const

export function eventStaffSpecs() {
  const buttonAt = (nodeId: string) => elementByNodeId(evt03b, nodeId).spec as ButtonSpec
  return {
    buttonAt,
    cancel: buttonAt(NODE.cancel),
    done: buttonAt(NODE.done),
    changeLeader: buttonAt(NODE.changeLeader),
    addDepartment: buttonAt(NODE.addDepartment),
    leader: elementByNodeId(evt03b, NODE.leader).spec as SelectSpec,
    newDepartment: elementByNodeId(evt03b, NODE.newDepartment).spec as InputSpec,
    leaderCard: elementByNodeId(evt03b, NODE.leaderCard).spec as ItemListSpec,
    departments: elementByNodeId(evt03b, NODE.departments).spec as ItemListSpec,
    panelHead: elementByNodeId(evt03b, NODE.panelHead).spec as SummarySpec,
    panelList: elementByNodeId(evt03b, NODE.panelList).spec as ItemListSpec,
  }
}

export function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`EVT-03B의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function optional(row: DataRow, field: string | undefined): string | null {
  if (field === undefined) return null
  const value = row[field]
  return value === undefined || Array.isArray(value) ? null : String(value)
}

export function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`EVT-03B의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}
