import type { DataRow } from '../../data-sources/definitions'

export const SCREEN = 'FIN-REV-01'
export const NODE = {
  head: '30:1400',
  facts: '30:1421',
  tabs: ['30:1454', '30:1457', '30:1460', '30:1463'],
  table: '30:1467',
  approvedAmount: '30:1482',
  result: '30:1485',
  reviewNote: '615:2',
  back: '30:1551',
  send: '30:1556',
} as const
export const ASSET = { back: '30:1552' } as const
export const TILE_TONE: Record<string, string> = { budgetAvailableNote: 'text-blue-600' }
export const BREADCRUMB_SEPARATORS = ['30:1373', '30:1378', '30:1383', '30:1388']

export function valueKey(listKey: string, itemId: string, fieldKey: string): string {
  return `${listKey}.${itemId}.${fieldKey}`
}

export function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`FIN-REV-01의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}
