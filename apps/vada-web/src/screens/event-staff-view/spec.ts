import type { DataRow } from '../../data-sources/definitions'

export const SCREEN = 'EVT-03A'
export const EMPTY_SCREEN = 'EVT-03C'
export const NODE = {
  staffTab: '20:6819',
  participantsTab: '20:6822',
  leaders: '20:6826',
  departments: '20:6847',
} as const
export const NODE_FIRST = {
  leader: '20:6833',
  department: '20:6851',
  leaderSection: '20:6855',
  leaderCard: '20:6859',
  memberSection: '20:6870',
  memberCard: '20:6875',
} as const
export const ASSET = {
  workspaceStatus: { startAt: '20:6805' } as Record<string, string>,
  leaderIcon: '20:6828',
  member: '20:6860',
  emptyIcon: '20:6503',
  emptyAddIcon: '20:6515',
} as const
export const ROLE_AVATAR: Record<string, string> = { yellow: '20:6834' }

export function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`EVT-03A의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
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
    throw new Error(`EVT-03A의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}
