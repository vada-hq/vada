import type { DataRow } from '../../data-sources/definitions'
import { elementByNodeId } from '../../spec/screens'
import { opsMeet05a } from '../../spec/screen-specs/opsMeet05a'
import { opsMeet05b } from '../../spec/screen-specs/opsMeet05b'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'OPS-MEET-05A'

export const NODE = {
  viewerChip: '20:961',
  liveStrip: '20:967',
  agenda: '20:995',
  documents: '20:1007',
  documentOpen: '20:1015',
  discussionHeader: '20:1019',
  discussion: '20:1043',
  savedNote: '20:1045',
  attach: '20:1047',
  decisionHeader: '20:1056',
  addDecision: '20:1061',
  decision: '20:1071',
  followUpHeader: '20:1078',
  addTask: '20:1083',
  followUps: '20:1089',
  agendaListHeader: '20:1105',
  agendaList: '20:1110',
  peopleHeader: '20:1151',
  people: '20:1154',
} as const

export const ASSET = {
  viewerChip: '20:962',
  present: '20:982',
  document: '20:1008',
  coeditors: '20:1026',
  attach: '20:1048',
  addDecision: '20:1062',
  addTask: '20:1084',
  followUpMark: '20:1090',
  followUpMenu: '20:1099',
} as const

export const BREADCRUMB_SEPARATORS = ['20:950', '20:955']

export const PRESENCE_DOT: Record<string, string> = {
  green: 'bg-green-500',
  gray: 'bg-gray-300',
}
export const NEUTRAL_DOT = 'bg-gray-300'

export const HOST = {
  screen: 'OPS-MEET-05B',
  endMeeting: { node: '20:1268', asset: '20:1269' },
  completeAgenda: { node: '20:1324', asset: '20:1325' },
  addDecision: { node: '20:1372', asset: '20:1373' },
  editDecision: { node: '20:1382', asset: null },
  nextAgenda: { node: '20:1464', asset: null },
} as const

export type HostActionSlot = (typeof HOST)[keyof Omit<typeof HOST, 'screen'>]

export function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet05a, nodeId).spec as SummarySpec
}

export function listAt(nodeId: string): ItemListSpec {
  return elementByNodeId(opsMeet05a, nodeId).spec as ItemListSpec
}

export function buttonAt(nodeId: string): ButtonSpec {
  return elementByNodeId(opsMeet05a, nodeId).spec as ButtonSpec
}

export function hostButtonAt(nodeId: string): ButtonSpec {
  return elementByNodeId(opsMeet05b, nodeId).spec as ButtonSpec
}

export function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-05A의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function drawnValue(spec: SummarySpec, at: number): string {
  return (spec.items ?? [])[at]?.value ?? ''
}
