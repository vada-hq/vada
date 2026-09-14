import type { DataRow } from '../../data-sources/definitions'

export const SCREEN = 'EVT-01'
export const NODE = {
  head: '20:6522',
  setupMode: '20:6530',
  leader: '20:6547',
  preview: '20:6554',
  back: '20:6671',
  save: '20:6676',
} as const
export const NODE_FIRST = {
  department: '20:6559',
  leaderSection: '20:6563',
  leaderCard: '20:6567',
  memberSection: '20:6578',
  memberCard: '20:6583',
} as const
export const ASSET = {
  leaderChevron: '20:6552',
  member: '20:6568',
  backArrow: '20:6672',
} as const
export const CARD_WIDTH = 982

export function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`EVT-01의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`EVT-01의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}
