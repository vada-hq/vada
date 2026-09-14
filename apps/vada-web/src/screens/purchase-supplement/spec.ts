import type { DataRow } from '../../data-sources/definitions'

export const SCREEN = 'FIN-SUP-01'

export const NODE = {
  notice: '30:1178',
  items: '30:1197',
  itemHeading: '30:1198',
  itemReason: '30:1204',
  itemExisting: '30:1209',
  corrections: '30:1239',
  attachments: '30:1264',
  saveDraft: '30:1291',
  resubmit: '30:1293',
} as const

export const ASSET = {
  notice: '30:1179',
  attachment: '30:1270',
} as const

export const BREADCRUMB_SEPARATORS = [
  '30:1144',
  '30:1149',
  '30:1154',
  '30:1159',
  '30:1164',
  '30:1169',
]

export function valueKey(itemId: string, setKey: string, fieldKey: string): string {
  return `${itemId}.${setKey}.${fieldKey}`
}

export function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`FIN-SUP-01의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}
