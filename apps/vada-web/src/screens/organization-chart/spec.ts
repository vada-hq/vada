import type { DataRow } from '../../data-sources/definitions'

export const SCREEN = 'ORG-03A'

export const NODE = {
  breadcrumb: '30:4501',
  executives: '30:4515',
  addMember: '30:4552',
  departments: '30:4558',
} as const

export const NODE_FIRST = {
  executive: '30:4524',
  department: '30:4564',
  leaderSection: '30:4568',
  leaderCard: '30:4572',
  memberSection: '30:4583',
  memberCard: '30:4588',
} as const

export const ASSET = {
  breadcrumbSeparator: '30:4505',
  executiveIcon: '30:4518',
  addMemberIcon: '30:4553',
  member: '30:4573',
} as const

export const ROLE_AVATAR: Record<string, string> = {
  yellow: '30:4526',
  blue: '30:4540',
}

export function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`ORG-03A의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`ORG-03A의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value
}
