import type { DataRow, DataValue } from '../../data-sources/definitions'
import { elementByNodeId } from '../../spec/screens'
import { opsMeet07 } from '../../spec/screen-specs/opsMeet07'
import type { ItemListSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'OPS-MEET-07'

export const NODE = {
  export: '20:2188',
  banner: '20:2197',
  head: '20:2213',
  decisionTile: '20:2231',
  followUpTile: '20:2236',
  minutes: '20:2243',
  agendas: '20:2248',
  followUpHeader: '20:2286',
  followUps: '20:2291',
  people: '20:2293',
  documents: '20:2317',
  documentDownload: '20:2330',
} as const

export const ASSET = {
  export: '20:2189',
  banner: '20:2198',
  document: '20:2322',
  download: '20:2330',
} as const

export const BREADCRUMB_SEPARATORS = ['20:2177', '20:2182']

export const ABSENTEE = {
  screen: 'OPS-MEET-08',
  acknowledge: { node: '20:2449', asset: '20:2450' },
  myFollowUpHeader: '20:2553',
  myFollowUps: '20:2558',
} as const

export function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet07, nodeId).spec as SummarySpec
}

export function listAt(nodeId: string): ItemListSpec {
  return elementByNodeId(opsMeet07, nodeId).spec as ItemListSpec
}

export function scalar(row: DataRow, field: string | undefined): string {
  const value: DataValue | undefined = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-07의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}
